/**
 * Bet placement.
 *
 * Every price is revalidated on the server at the moment of placement. The
 * browser's copy of the odds is treated as a claim about what the user saw,
 * never as the price to bet at — if it no longer matches the market, the bet
 * is refused and the move is put to the user.
 *
 * Once accepted, the price is written to `bet_selections` and is never
 * touched again by anything in KOVR.
 */

import type { Bet, EventWithMarkets, Market, MarketSelection, Wallet } from '../domain/types.js';
import type { Cents } from '../core/money.js';
import { formatCents } from '../core/money.js';
import type { AmericanOdds } from '../core/odds.js';
import { combineParlayOdds, formatAmericanOdds, isBetterForBettor, payoutCents, profitCents } from '../core/odds.js';
import { acceptsNewBets } from '../domain/status.js';
import type { BetRepository, NewBetSelection } from '../store/repositories/betRepo.js';
import type { WalletRepository } from '../store/repositories/walletRepo.js';
import { InsufficientFundsError } from '../store/repositories/walletRepo.js';
import type { EventRepository } from '../store/repositories/eventRepo.js';
import type { Database } from '../store/db.js';
import { DEMO_USER_ID } from './walletService.js';
import type { WalletService } from './walletService.js';

export const MIN_STAKE_CENTS = 100;
export const MAX_STAKE_CENTS = 1_000_000;
/** Window in which an identical repeat submission is treated as a double-tap. */
const DUPLICATE_WINDOW_MS = 10_000;

export interface SelectionRequest {
  eventId: string;
  marketKey: string;
  selectionId: string;
  /** The price the interface was showing when the user tapped it. */
  displayedPrice: AmericanOdds;
}

export interface PlaceBetRequest {
  selections: readonly SelectionRequest[];
  stakeCents: Cents;
  /**
   * Set once the user has been shown a price move and chosen to take it.
   * Without it, a moved price refuses the bet rather than silently repricing.
   */
  acceptCurrentOdds?: boolean;
}

export interface OddsChange {
  eventId: string;
  eventName: string;
  /** Identifies the leg exactly; two events can share a selection name. */
  selectionId: string;
  selectionName: string;
  marketName: string;
  previousPrice: AmericanOdds;
  currentPrice: AmericanOdds;
  improved: boolean;
  message: string;
}

export interface Quote {
  stakeCents: Cents;
  combinedPrice: AmericanOdds;
  profitCents: Cents;
  payoutCents: Cents;
  legs: Array<{
    eventId: string;
    eventName: string;
    marketKey: string;
    marketName: string;
    selectionId: string;
    selectionName: string;
    price: AmericanOdds;
    line: number | null;
  }>;
}

/** Every way placement can be refused, other than a price move. */
export type BetFailureCode =
  | 'EMPTY_SLIP'
  | 'TOO_MANY_LEGS'
  | 'DUPLICATE_LEG'
  | 'EVENT_NOT_FOUND'
  | 'EVENT_CLOSED'
  | 'EVENT_STARTED'
  | 'MARKET_NOT_FOUND'
  | 'SELECTION_NOT_FOUND'
  | 'INVALID_STAKE'
  | 'STAKE_TOO_SMALL'
  | 'STAKE_TOO_LARGE'
  | 'INSUFFICIENT_FUNDS'
  | 'DUPLICATE_BET';

export type PlaceBetResult =
  | { ok: true; bet: Bet; wallet: Wallet }
  | { ok: false; code: 'ODDS_CHANGED'; message: string; changes: OddsChange[]; quote: Quote }
  | { ok: false; code: BetFailureCode; message: string };

interface ResolvedLeg {
  event: EventWithMarkets['event'];
  market: Market;
  selection: MarketSelection;
  request: SelectionRequest;
}

export class BetService {
  constructor(
    private readonly database: Database,
    private readonly events: EventRepository,
    private readonly bets: BetRepository,
    private readonly wallets: WalletRepository,
    private readonly walletService: WalletService,
  ) {}

  /* ───────────────────────────── validation ──────────────────────── */

  /**
   * Resolve each requested selection against the live market.
   * Returns a failure string on the first problem, in the order the
   * specification lays out: event, start time, market, selection, price.
   */
  private resolve(selections: readonly SelectionRequest[], now: number): ResolvedLeg[] | { error: PlaceBetResult } {
    if (selections.length === 0) {
      return { error: { ok: false, code: 'EMPTY_SLIP', message: 'Add a selection before placing a bet.' } };
    }
    if (selections.length > 12) {
      return { error: { ok: false, code: 'TOO_MANY_LEGS', message: 'A bet may carry at most 12 selections.' } };
    }

    const seen = new Set<string>();
    const legs: ResolvedLeg[] = [];

    for (const request of selections) {
      const key = `${request.eventId}|${request.marketKey}|${request.selectionId}`;
      if (seen.has(key)) {
        return { error: { ok: false, code: 'DUPLICATE_LEG', message: 'The same selection appears twice.' } };
      }
      seen.add(key);

      const event = this.events.findEvent(request.eventId);
      if (!event) {
        return { error: { ok: false, code: 'EVENT_NOT_FOUND', message: 'That event is no longer available.' } };
      }

      if (!acceptsNewBets(event.status)) {
        return {
          error: {
            ok: false,
            code: 'EVENT_CLOSED',
            message:
              event.status === 'UNKNOWN'
                ? `Betting on ${event.name} is closed while its status is unconfirmed.`
                : `Betting on ${event.name} is closed.`,
          },
        };
      }

      // Belt and braces: the status could be stale, but the clock is not.
      if (Date.parse(event.startTime) <= now) {
        return {
          error: { ok: false, code: 'EVENT_STARTED', message: `${event.name} has already started.` },
        };
      }

      const markets = this.events.listMarkets(event.id);
      const market = markets.find((candidate) => candidate.key === request.marketKey);
      if (!market) {
        return {
          error: { ok: false, code: 'MARKET_NOT_FOUND', message: 'That market is no longer offered.' },
        };
      }

      const selection = market.selections.find((candidate) => candidate.id === request.selectionId);
      if (!selection) {
        return {
          error: { ok: false, code: 'SELECTION_NOT_FOUND', message: 'That selection is no longer offered.' },
        };
      }

      legs.push({ event, market, selection, request });
    }

    return legs;
  }

  private static quoteFor(legs: readonly ResolvedLeg[], stakeCents: Cents): Quote {
    const prices = legs.map((leg) => leg.selection.price);
    const combined = combineParlayOdds(prices);
    return {
      stakeCents,
      combinedPrice: combined,
      profitCents: profitCents(stakeCents, combined),
      payoutCents: payoutCents(stakeCents, combined),
      legs: legs.map((leg) => ({
        eventId: leg.event.id,
        eventName: leg.event.name,
        marketKey: leg.market.key,
        marketName: leg.market.name,
        selectionId: leg.selection.id,
        selectionName: leg.selection.name,
        price: leg.selection.price,
        line: leg.selection.line,
      })),
    };
  }

  /** Price a slip without placing anything. Drives the betslip preview. */
  quote(selections: readonly SelectionRequest[], stakeCents: Cents): Quote | { error: string } {
    const resolved = this.resolve(selections, Date.now());
    if (!Array.isArray(resolved)) return { error: resolved.error.ok ? 'unknown' : resolved.error.message };
    return BetService.quoteFor(resolved, stakeCents);
  }

  /* ────────────────────────────── placement ──────────────────────── */

  place(request: PlaceBetRequest, at = new Date().toISOString()): PlaceBetResult {
    const now = Date.parse(at);
    const stake = request.stakeCents;

    if (!Number.isSafeInteger(stake) || stake <= 0) {
      return { ok: false, code: 'INVALID_STAKE', message: 'Enter a stake greater than zero.' };
    }
    if (stake < MIN_STAKE_CENTS) {
      return { ok: false, code: 'STAKE_TOO_SMALL', message: `The minimum stake is ${formatCents(MIN_STAKE_CENTS)}.` };
    }
    if (stake > MAX_STAKE_CENTS) {
      return { ok: false, code: 'STAKE_TOO_LARGE', message: `The maximum stake is ${formatCents(MAX_STAKE_CENTS)}.` };
    }

    const resolved = this.resolve(request.selections, now);
    if (!Array.isArray(resolved)) return resolved.error;
    const legs = resolved;

    // Compare what the user was shown against what the market says now.
    const changes: OddsChange[] = [];
    for (const leg of legs) {
      if (leg.request.displayedPrice !== leg.selection.price) {
        const improved = isBetterForBettor(leg.request.displayedPrice, leg.selection.price);
        changes.push({
          eventId: leg.event.id,
          eventName: leg.event.name,
          selectionId: leg.selection.id,
          selectionName: leg.selection.name,
          marketName: leg.market.name,
          previousPrice: leg.request.displayedPrice,
          currentPrice: leg.selection.price,
          improved,
          message: `Odds changed from ${formatAmericanOdds(leg.request.displayedPrice)} to ${formatAmericanOdds(
            leg.selection.price,
          )}.`,
        });
      }
    }

    if (changes.length > 0 && request.acceptCurrentOdds !== true) {
      return {
        ok: false,
        code: 'ODDS_CHANGED',
        message:
          changes.length === 1
            ? (changes[0]?.message ?? 'Odds changed.')
            : `${changes.length} prices changed before this bet was placed.`,
        changes,
        quote: BetService.quoteFor(legs, stake),
      };
    }

    const quote = BetService.quoteFor(legs, stake);
    const { wallet } = this.walletService.ensureDemoAccount(at);

    if (stake > wallet.balanceCents) {
      return {
        ok: false,
        code: 'INSUFFICIENT_FUNDS',
        message: `Your simulated balance is ${formatCents(wallet.balanceCents)}.`,
      };
    }

    if (this.isDoubleSubmission(legs, stake, now)) {
      return {
        ok: false,
        code: 'DUPLICATE_BET',
        message: 'That bet was just placed. Check My Bets before placing it again.',
      };
    }

    const newSelections: NewBetSelection[] = legs.map((leg) => ({
      eventId: leg.event.id,
      providerEventId: leg.event.providerEventId,
      leagueId: leg.event.leagueId,
      eventName: leg.event.name,
      eventStartTime: leg.event.startTime,
      marketKey: leg.market.key,
      marketName: leg.market.name,
      selectionId: leg.selection.id,
      selectionName: leg.selection.name,
      participantExternalId: leg.selection.participantExternalId,
      line: leg.selection.line,
      // The price is frozen here and nowhere else.
      priceAmerican: leg.selection.price,
      bookmakerKey: leg.selection.bookmakerKey,
      marketOffersDraw: leg.market.selections.some((s) => s.name.trim().toLowerCase() === 'draw'),
    }));

    try {
      // Debit and bet creation are one unit: a bet never exists unpaid for,
      // and money is never taken without a bet to show for it.
      const bet = this.database.transaction(() => {
        this.wallets.post(
          {
            walletId: wallet.id,
            type: 'BET_PLACED',
            amountCents: -stake,
            description:
              legs.length === 1
                ? `Bet placed: ${legs[0]?.selection.name} ${formatAmericanOdds(quote.combinedPrice)}`
                : `${legs.length}-leg parlay placed at ${formatAmericanOdds(quote.combinedPrice)}`,
          },
          at,
        );

        return this.bets.create(
          {
            userId: DEMO_USER_ID,
            walletId: wallet.id,
            stakeCents: stake,
            priceAmerican: quote.combinedPrice,
            potentialPayoutCents: quote.payoutCents,
            selections: newSelections,
          },
          at,
        );
      });

      const updated = this.wallets.findById(wallet.id);
      return { ok: true, bet, wallet: updated ?? wallet };
    } catch (error) {
      if (error instanceof InsufficientFundsError) {
        return {
          ok: false,
          code: 'INSUFFICIENT_FUNDS',
          message: `Your simulated balance is ${formatCents(error.balanceCents)}.`,
        };
      }
      throw error;
    }
  }

  /**
   * Guard against a double-tapped Place Bet.
   *
   * Only an identical slip at an identical stake within a few seconds counts.
   * Betting the same selection again later is perfectly legitimate and is
   * deliberately not blocked.
   */
  private isDoubleSubmission(legs: readonly ResolvedLeg[], stake: Cents, now: number): boolean {
    const signature = legs
      .map((leg) => `${leg.event.id}|${leg.market.key}|${leg.selection.id}`)
      .sort()
      .join('~');

    for (const bet of this.bets.listByUser(DEMO_USER_ID, ['OPEN'], 20)) {
      if (bet.stakeCents !== stake) continue;
      if (now - Date.parse(bet.placedAt) > DUPLICATE_WINDOW_MS) continue;
      const existing = bet.selections
        .map((selection) => `${selection.eventId}|${selection.marketKey}|${selection.selectionId}`)
        .sort()
        .join('~');
      if (existing === signature) return true;
    }
    return false;
  }

  /* ─────────────────────────────── reads ─────────────────────────── */

  listBets(statuses?: readonly Bet['status'][], limit = 100): Bet[] {
    return this.bets.listByUser(DEMO_USER_ID, statuses, limit);
  }

  findBet(betId: string): Bet | null {
    const bet = this.bets.findById(betId);
    return bet && bet.userId === DEMO_USER_ID ? bet : null;
  }

  counts(): Record<Bet['status'], number> {
    return this.bets.countByStatus(DEMO_USER_ID);
  }
}
