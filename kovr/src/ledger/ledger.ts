/**
 * The KOVR ledger.
 *
 * Holds the balance, the bets and their settlement, over any storage that
 * can read and write one string. The whole document is rewritten on every
 * change, so a bet and its debit either both land or neither does.
 *
 * The balance is never assigned directly except through `adjustBalance`,
 * which writes a transaction like everything else. `reconcile()` replays the
 * ledger and compares it with the stored balance.
 */

import type { Bet, BetStatus, EventWithMarkets, SportEvent, Wallet, WalletTransaction } from '../domain/types.js';
import type { Cents } from '../core/money.js';
import { assertCents, formatCents, MAX_CENTS } from '../core/money.js';
import type { AmericanOdds } from '../core/odds.js';
import { combineParlayOdds, formatAmericanOdds, isBetterForBettor, payoutCents, profitCents } from '../core/odds.js';
import { acceptsNewBets } from '../domain/status.js';
import { combineGrades, gradeLeg } from '../domain/grading.js';
import type { LegGrade, SettlementFact } from '../domain/grading.js';
import type { LedgerState, Reconciliation } from './types.js';
import { LEDGER_VERSION } from './types.js';
import type { LedgerStorage } from './storage.js';
import { newId } from './ids.js';

export const MIN_STAKE_CENTS = 100;
export const MAX_STAKE_CENTS = 1_000_000;
export const MIN_DEPOSIT_CENTS = 500;
export const MAX_DEPOSIT_CENTS = 1_000_000;
const DUPLICATE_WINDOW_MS = 10_000;

export class LedgerError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'LedgerError';
    this.code = code;
  }
}

/* ─────────────────────────── placement types ───────────────────────── */

export interface SelectionRequest {
  eventId: string;
  marketKey: string;
  selectionId: string;
  /** The price the interface was showing when the user tapped it. */
  displayedPrice: AmericanOdds;
}

export interface OddsChange {
  eventId: string;
  eventName: string;
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
}

export type PlaceFailureCode =
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

export type PlaceResult =
  | { ok: true; bet: Bet; wallet: Wallet }
  | { ok: false; code: 'ODDS_CHANGED'; message: string; changes: OddsChange[]; quote: Quote }
  | { ok: false; code: PlaceFailureCode; message: string };

export interface PlaceRequest {
  selections: readonly SelectionRequest[];
  stakeCents: Cents;
  acceptCurrentOdds?: boolean;
}

export interface SettlementOutcome {
  betId: string;
  status: BetStatus | 'PENDING';
  payoutCents: Cents;
  reason: string;
}

/* ──────────────────────────────── engine ───────────────────────────── */

export class Ledger {
  private state: LedgerState | null = null;
  private writing: Promise<void> = Promise.resolve();

  constructor(
    private readonly storage: LedgerStorage,
    private readonly openingBalanceCents: Cents,
  ) {}

  /* ─────────────────────────── state access ────────────────────────── */

  private freshState(at: string): LedgerState {
    const wallet: Wallet = { id: newId('wal'), userId: 'kovr', balanceCents: 0, currency: 'USD', updatedAt: at };
    const state: LedgerState = {
      version: LEDGER_VERSION,
      createdAt: at,
      wallet,
      transactions: [],
      bets: [],
      settledBetIds: [],
    };
    if (this.openingBalanceCents > 0) {
      applyTransaction(state, {
        type: 'DEMO_INITIAL_BALANCE',
        amountCents: this.openingBalanceCents,
        description: 'Opening balance',
        at,
      });
    }
    return state;
  }

  async load(): Promise<LedgerState> {
    if (this.state) return this.state;

    const at = new Date().toISOString();
    const stored = await this.storage.read();
    if (stored) {
      try {
        const parsed: unknown = JSON.parse(stored);
        if (isLedgerState(parsed)) {
          this.state = parsed;
          return this.state;
        }
      } catch {
        // A corrupt document is replaced rather than crashing the app. The
        // alternative is a wallet that can never be opened again.
      }
    }

    this.state = this.freshState(at);
    await this.persist();
    return this.state;
  }

  /** Serialise writes so two rapid actions cannot interleave. */
  private async persist(): Promise<void> {
    const state = this.state;
    if (!state) return;
    const document = JSON.stringify(state);
    this.writing = this.writing.then(() => this.storage.write(document)).catch(() => undefined);
    await this.writing;
  }

  async wallet(): Promise<Wallet> {
    return (await this.load()).wallet;
  }

  async transactions(limit = 100): Promise<WalletTransaction[]> {
    const state = await this.load();
    return [...state.transactions].reverse().slice(0, Math.max(1, limit));
  }

  async bets(statuses?: readonly BetStatus[], limit = 200): Promise<Bet[]> {
    const state = await this.load();
    const filtered = statuses ? state.bets.filter((bet) => statuses.includes(bet.status)) : state.bets;
    return [...filtered].sort((a, b) => b.placedAt.localeCompare(a.placedAt)).slice(0, limit);
  }

  async findBet(betId: string): Promise<Bet | null> {
    const state = await this.load();
    return state.bets.find((bet) => bet.id === betId) ?? null;
  }

  async counts(): Promise<Record<BetStatus, number>> {
    const state = await this.load();
    const counts: Record<BetStatus, number> = { OPEN: 0, WON: 0, LOST: 0, PUSH: 0, VOID: 0, CANCELLED: 0 };
    for (const bet of state.bets) counts[bet.status]++;
    return counts;
  }

  async reconcile(): Promise<Reconciliation> {
    const state = await this.load();
    let total = 0;
    for (const transaction of state.transactions) total += transaction.amountCents;
    return {
      ledgerTotalCents: total,
      balanceCents: state.wallet.balanceCents,
      balanced: total === state.wallet.balanceCents,
      entries: state.transactions.length,
    };
  }

  /* ───────────────────────────── money in ──────────────────────────── */

  async deposit(amountCents: Cents): Promise<Wallet> {
    const state = await this.load();
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      throw new LedgerError('INVALID_AMOUNT', 'Enter an amount greater than zero.');
    }
    if (amountCents < MIN_DEPOSIT_CENTS) {
      throw new LedgerError('AMOUNT_TOO_SMALL', `The smallest deposit is ${formatCents(MIN_DEPOSIT_CENTS)}.`);
    }
    if (amountCents > MAX_DEPOSIT_CENTS) {
      throw new LedgerError('AMOUNT_TOO_LARGE', `The largest deposit is ${formatCents(MAX_DEPOSIT_CENTS)}.`);
    }
    if (state.wallet.balanceCents + amountCents > MAX_CENTS) {
      throw new LedgerError('BALANCE_LIMIT', 'That would exceed the balance limit.');
    }

    applyTransaction(state, {
      type: 'DEMO_DEPOSIT',
      amountCents,
      description: `Deposit ${formatCents(amountCents)}`,
      at: new Date().toISOString(),
    });
    await this.persist();
    return state.wallet;
  }

  async withdraw(amountCents: Cents): Promise<Wallet> {
    const state = await this.load();
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      throw new LedgerError('INVALID_AMOUNT', 'Enter an amount greater than zero.');
    }
    if (amountCents > state.wallet.balanceCents) {
      throw new LedgerError('INSUFFICIENT_FUNDS', `Your balance is ${formatCents(state.wallet.balanceCents)}.`);
    }

    applyTransaction(state, {
      type: 'DEMO_WITHDRAWAL',
      amountCents: -amountCents,
      description: `Withdrawal ${formatCents(amountCents)}`,
      at: new Date().toISOString(),
    });
    await this.persist();
    return state.wallet;
  }

  /**
   * Set the balance outright.
   *
   * Reached only through the hidden control, and still written as a
   * transaction so the ledger continues to reconcile against the balance.
   */
  async adjustBalance(targetCents: Cents): Promise<Wallet> {
    const state = await this.load();
    assertCents(targetCents, 'balance');
    if (targetCents < 0) throw new LedgerError('INVALID_AMOUNT', 'A balance cannot be negative.');
    if (targetCents > MAX_CENTS) throw new LedgerError('BALANCE_LIMIT', 'That is above the balance limit.');

    const delta = targetCents - state.wallet.balanceCents;
    if (delta === 0) return state.wallet;

    applyTransaction(state, {
      type: delta > 0 ? 'DEMO_DEPOSIT' : 'DEMO_WITHDRAWAL',
      amountCents: delta,
      description: `Balance set to ${formatCents(targetCents)}`,
      at: new Date().toISOString(),
    });
    await this.persist();
    return state.wallet;
  }

  async reset(): Promise<Wallet> {
    const at = new Date().toISOString();
    this.state = this.freshState(at);
    await this.persist();
    return this.state.wallet;
  }

  /* ──────────────────────────── placement ──────────────────────────── */

  /**
   * Place a bet against live market data.
   *
   * `live` holds the events, freshly fetched, that the requested selections
   * belong to. Every price is re-read from it: the price the interface was
   * showing is treated as a claim about what the user saw, never as the
   * price to charge.
   */
  async place(
    request: PlaceRequest,
    live: ReadonlyMap<string, EventWithMarkets>,
    now = Date.now(),
  ): Promise<PlaceResult> {
    const state = await this.load();
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
    if (request.selections.length === 0) {
      return { ok: false, code: 'EMPTY_SLIP', message: 'Add a selection before placing a bet.' };
    }
    if (request.selections.length > 12) {
      return { ok: false, code: 'TOO_MANY_LEGS', message: 'A bet may carry at most 12 selections.' };
    }

    const seen = new Set<string>();
    const legs: ResolvedLeg[] = [];

    for (const wanted of request.selections) {
      const key = `${wanted.eventId}|${wanted.marketKey}|${wanted.selectionId}`;
      if (seen.has(key)) {
        return { ok: false, code: 'DUPLICATE_LEG', message: 'The same selection appears twice.' };
      }
      seen.add(key);

      const entry = live.get(wanted.eventId);
      if (!entry) {
        return { ok: false, code: 'EVENT_NOT_FOUND', message: 'That event is no longer available.' };
      }
      const { event } = entry;

      if (!acceptsNewBets(event.status)) {
        return {
          ok: false,
          code: 'EVENT_CLOSED',
          message:
            event.status === 'UNKNOWN'
              ? `Betting on ${event.name} is closed while its status is unconfirmed.`
              : `Betting on ${event.name} is closed.`,
        };
      }
      if (Date.parse(event.startTime) <= now) {
        return { ok: false, code: 'EVENT_STARTED', message: `${event.name} has already started.` };
      }

      const market = entry.markets.find((candidate) => candidate.key === wanted.marketKey);
      if (!market) {
        return { ok: false, code: 'MARKET_NOT_FOUND', message: 'That market is no longer offered.' };
      }
      const selection = market.selections.find((candidate) => candidate.id === wanted.selectionId);
      if (!selection) {
        return { ok: false, code: 'SELECTION_NOT_FOUND', message: 'That selection is no longer offered.' };
      }

      legs.push({ event, market, selection, requested: wanted });
    }

    const changes: OddsChange[] = [];
    for (const leg of legs) {
      if (leg.requested.displayedPrice !== leg.selection.price) {
        changes.push({
          eventId: leg.event.id,
          eventName: leg.event.name,
          selectionId: leg.selection.id,
          selectionName: leg.selection.name,
          marketName: leg.market.name,
          previousPrice: leg.requested.displayedPrice,
          currentPrice: leg.selection.price,
          improved: isBetterForBettor(leg.requested.displayedPrice, leg.selection.price),
          message: `Odds changed from ${formatAmericanOdds(leg.requested.displayedPrice)} to ${formatAmericanOdds(
            leg.selection.price,
          )}.`,
        });
      }
    }

    const combined = combineParlayOdds(legs.map((leg) => leg.selection.price));
    const quote: Quote = {
      stakeCents: stake,
      combinedPrice: combined,
      profitCents: profitCents(stake, combined),
      payoutCents: payoutCents(stake, combined),
    };

    if (changes.length > 0 && request.acceptCurrentOdds !== true) {
      return {
        ok: false,
        code: 'ODDS_CHANGED',
        message:
          changes.length === 1
            ? (changes[0]?.message ?? 'Odds changed.')
            : `${changes.length} prices changed before this bet was placed.`,
        changes,
        quote,
      };
    }

    if (stake > state.wallet.balanceCents) {
      return { ok: false, code: 'INSUFFICIENT_FUNDS', message: `Your balance is ${formatCents(state.wallet.balanceCents)}.` };
    }

    // A double-tapped Place Bet is not two bets. Betting the same selection
    // again later is legitimate and deliberately not blocked.
    const signature = legs.map((leg) => `${leg.event.id}|${leg.market.key}|${leg.selection.id}`).sort().join('~');
    const duplicate = state.bets.some(
      (bet) =>
        bet.status === 'OPEN' &&
        bet.stakeCents === stake &&
        now - Date.parse(bet.placedAt) <= DUPLICATE_WINDOW_MS &&
        bet.selections.map((s) => `${s.eventId}|${s.marketKey}|${s.selectionId}`).sort().join('~') === signature,
    );
    if (duplicate) {
      return { ok: false, code: 'DUPLICATE_BET', message: 'That bet was just placed. Check My Bets before placing it again.' };
    }

    const at = new Date(now).toISOString();
    const betId = newId('bet');
    const bet: Bet = {
      id: betId,
      userId: 'kovr',
      walletId: state.wallet.id,
      stakeCents: stake,
      priceAmerican: combined,
      potentialPayoutCents: quote.payoutCents,
      status: 'OPEN',
      placedAt: at,
      settledAt: null,
      payoutCents: null,
      selections: legs.map((leg) => ({
        id: newId('bsl'),
        betId,
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
        // Frozen here and nowhere else. Nothing rewrites this.
        priceAmerican: leg.selection.price,
        bookmakerKey: leg.selection.bookmakerKey,
        marketOffersDraw: leg.market.selections.some((s) => s.name.trim().toLowerCase() === 'draw'),
        status: 'OPEN',
        settledAt: null,
      })),
    };

    applyTransaction(state, {
      type: 'BET_PLACED',
      amountCents: -stake,
      description:
        legs.length === 1
          ? `${legs[0]?.selection.name} ${formatAmericanOdds(combined)}`
          : `${legs.length}-leg parlay ${formatAmericanOdds(combined)}`,
      betId,
      at,
    });
    state.bets.push(bet);

    await this.persist();
    return { ok: true, bet, wallet: state.wallet };
  }

  /* ──────────────────────────── settlement ─────────────────────────── */

  /**
   * Settle every open bet whose events are confirmed.
   *
   * `events` holds freshly fetched events keyed by id. A bet is graded only
   * from a result the provider confirmed; anything else stays open. Safe to
   * run repeatedly — a bet already in `settledBetIds` is skipped.
   */
  async settle(events: ReadonlyMap<string, SettlementFact>): Promise<SettlementOutcome[]> {
    const state = await this.load();
    const outcomes: SettlementOutcome[] = [];
    let changed = false;

    for (const bet of state.bets) {
      if (bet.status !== 'OPEN') continue;
      if (state.settledBetIds.includes(bet.id)) continue;

      const grades = new Map<string, LegGrade>();
      let missing = false;
      for (const selection of bet.selections) {
        const event = events.get(selection.eventId);
        if (!event) {
          missing = true;
          break;
        }
        grades.set(selection.id, gradeLeg(selection, event));
      }
      // An event KOVR could not fetch is unknown, not void: leave it open.
      if (missing) continue;

      const combined = combineGrades(bet, grades);
      if (combined.status === 'PENDING') {
        outcomes.push({ betId: bet.id, status: 'PENDING', payoutCents: 0, reason: combined.reason });
        continue;
      }

      const at = new Date().toISOString();
      bet.status = combined.status;
      bet.payoutCents = combined.payoutCents;
      bet.settledAt = at;
      for (const selection of bet.selections) {
        const grade = grades.get(selection.id);
        selection.status = grade === 'UNGRADABLE' || grade === undefined ? 'VOID' : grade;
        selection.settledAt = at;
      }
      state.settledBetIds.push(bet.id);

      if (combined.payoutCents > 0) {
        applyTransaction(state, {
          type: combined.status === 'WON' ? 'BET_PAYOUT' : 'BET_REFUND',
          amountCents: combined.payoutCents,
          description:
            combined.status === 'WON'
              ? `Won ${formatCents(combined.payoutCents)}`
              : `${titleCase(combined.status)} — ${formatCents(combined.payoutCents)} returned`,
          betId: bet.id,
          at,
        });
      }

      changed = true;
      outcomes.push({
        betId: bet.id,
        status: combined.status,
        payoutCents: combined.payoutCents,
        reason: combined.reason,
      });
    }

    if (changed) await this.persist();
    return outcomes;
  }

  /** Event ids the ledger needs results for. Drives what the client fetches. */
  async openEventIds(): Promise<string[]> {
    const state = await this.load();
    const ids = new Set<string>();
    for (const bet of state.bets) {
      if (bet.status !== 'OPEN') continue;
      for (const selection of bet.selections) ids.add(selection.eventId);
    }
    return [...ids];
  }
}

/* ───────────────────────────── internals ───────────────────────────── */

interface ResolvedLeg {
  event: SportEvent;
  market: EventWithMarkets['markets'][number];
  selection: EventWithMarkets['markets'][number]['selections'][number];
  requested: SelectionRequest;
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

/** The only way the balance moves. Writes the row and updates the wallet. */
function applyTransaction(
  state: LedgerState,
  entry: { type: WalletTransaction['type']; amountCents: Cents; description: string; betId?: string; at: string },
): WalletTransaction {
  assertCents(entry.amountCents, 'transaction amount');
  const next = state.wallet.balanceCents + entry.amountCents;
  assertCents(next, 'resulting balance');
  if (next < 0) throw new LedgerError('INSUFFICIENT_FUNDS', 'That would take the balance below zero.');

  const transaction: WalletTransaction = {
    id: newId('txn'),
    walletId: state.wallet.id,
    type: entry.type,
    amountCents: entry.amountCents,
    balanceAfterCents: next,
    description: entry.description,
    betId: entry.betId ?? null,
    createdAt: entry.at,
  };
  state.transactions.push(transaction);
  state.wallet.balanceCents = next;
  state.wallet.updatedAt = entry.at;
  return transaction;
}

function isLedgerState(value: unknown): value is LedgerState {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<LedgerState>;
  return (
    candidate.version === LEDGER_VERSION &&
    typeof candidate.wallet === 'object' &&
    candidate.wallet !== null &&
    Array.isArray(candidate.transactions) &&
    Array.isArray(candidate.bets) &&
    Array.isArray(candidate.settledBetIds)
  );
}
