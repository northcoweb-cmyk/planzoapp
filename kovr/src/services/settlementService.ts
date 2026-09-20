/**
 * Settlement.
 *
 * Nothing here grades a bet because a start time has passed. A bet is graded
 * only from a result the provider has confirmed — `event.result` is non-null
 * exactly when the provider reported the event complete and published scores
 * KOVR could read — or because the event was cancelled outright.
 *
 * Settlement is idempotent twice over: `settlements.bet_id` is UNIQUE, and
 * the payout transaction carries an idempotency key. Running a sweep twice
 * cannot pay a user twice.
 */

import type { Bet, BetSelection, BetStatus, SportEvent } from '../domain/types.js';
import type { Cents } from '../core/money.js';
import { formatCents } from '../core/money.js';
import { combineParlayOdds, payoutCents } from '../core/odds.js';
import { describeMarket } from '../domain/markets.js';
import type { BetRepository } from '../store/repositories/betRepo.js';
import { DuplicateSettlementError } from '../store/repositories/betRepo.js';
import type { WalletRepository } from '../store/repositories/walletRepo.js';
import { DuplicateTransactionError } from '../store/repositories/walletRepo.js';
import type { EventRepository } from '../store/repositories/eventRepo.js';
import type { CatalogRepository } from '../store/repositories/catalogRepo.js';
import type { Database } from '../store/db.js';
import type { SportsDataProvider } from '../providers/SportsDataProvider.js';
import { RefreshManager } from './refreshManager.js';

/** A single leg's grade. `UNGRADABLE` means "not enough confirmed data yet". */
export type LegGrade = 'WON' | 'LOST' | 'PUSH' | 'VOID' | 'UNGRADABLE';

/** Every bet status except OPEN — what a settled bet may become. */
export type SettledStatus = Exclude<BetStatus, 'OPEN'>;

export interface SettlementOutcome {
  betId: string;
  status: BetStatus | 'PENDING';
  payoutCents: Cents;
  reason: string;
}

export interface SweepReport {
  eventsChecked: number;
  resultsRecorded: number;
  betsSettled: number;
  betsPending: number;
  errors: string[];
}

const DRAW_NAMES = new Set(['draw', 'tie']);

export class SettlementService {
  constructor(
    private readonly database: Database,
    private readonly events: EventRepository,
    private readonly bets: BetRepository,
    private readonly wallets: WalletRepository,
    private readonly catalog: CatalogRepository,
    private readonly provider: SportsDataProvider,
  ) {}

  /* ─────────────────────────────── grading ────────────────────────── */

  /**
   * Grade one leg against its event.
   *
   * Returns `UNGRADABLE` whenever the confirmed data does not actually
   * determine the outcome — an unpriced prop, a spread with no scores, a
   * market KOVR cannot grade. Those bets stay open and visible rather than
   * being guessed at in either direction.
   */
  static gradeLeg(selection: BetSelection, event: SportEvent): LegGrade {
    if (event.status === 'CANCELLED') return 'VOID';

    const result = event.result;
    if (!result) return 'UNGRADABLE';

    const kind = describeMarket(selection.marketKey).kind;
    const isDrawSelection = DRAW_NAMES.has(selection.selectionName.trim().toLowerCase());

    if (kind === 'MONEYLINE' || kind === 'OUTRIGHT') {
      if (isDrawSelection) return result.isDraw ? 'WON' : 'LOST';
      if (result.isDraw) {
        // A three-way market priced the draw separately, so backing a side
        // loses. A two-way market did not, so the stake comes back.
        return selection.marketOffersDraw ? 'LOST' : 'PUSH';
      }
      if (selection.participantExternalId === null) return 'UNGRADABLE';
      return selection.participantExternalId === result.winnerExternalId ? 'WON' : 'LOST';
    }

    if (kind === 'SPREAD') {
      if (selection.line === null || selection.participantExternalId === null) return 'UNGRADABLE';
      const mine = result.scores.find((s) => s.externalId === selection.participantExternalId);
      const theirs = result.scores.find((s) => s.externalId !== selection.participantExternalId);
      if (!mine || !theirs) return 'UNGRADABLE';

      const adjustedMargin = mine.score - theirs.score + selection.line;
      if (adjustedMargin > 0) return 'WON';
      if (adjustedMargin < 0) return 'LOST';
      return 'PUSH';
    }

    if (kind === 'TOTAL') {
      if (selection.line === null) return 'UNGRADABLE';
      if (result.scores.length < 2) return 'UNGRADABLE';
      const total = result.scores.reduce((sum, entry) => sum + entry.score, 0);
      const name = selection.selectionName.trim().toLowerCase();

      if (name.startsWith('over')) {
        if (total > selection.line) return 'WON';
        if (total < selection.line) return 'LOST';
        return 'PUSH';
      }
      if (name.startsWith('under')) {
        if (total < selection.line) return 'WON';
        if (total > selection.line) return 'LOST';
        return 'PUSH';
      }
      return 'UNGRADABLE';
    }

    // Player props, period markets and anything else need detail the
    // configured provider does not supply. They are left open, not guessed.
    return 'UNGRADABLE';
  }

  /**
   * Combine leg grades into a bet outcome.
   *
   * Pushed and voided legs drop out of the price and the remaining legs are
   * re-combined — the standard rule, and the only one that keeps a parlay's
   * payout honest when one leg is refunded.
   */
  static combine(
    bet: Bet,
    grades: ReadonlyMap<string, LegGrade>,
  ): { status: SettledStatus | 'PENDING'; payoutCents: Cents; reason: string } {
    const values = bet.selections.map((selection) => grades.get(selection.id) ?? 'UNGRADABLE');

    if (values.includes('UNGRADABLE')) {
      return { status: 'PENDING', payoutCents: 0, reason: 'Awaiting a confirmed result for every leg.' };
    }
    if (values.includes('LOST')) {
      return { status: 'LOST', payoutCents: 0, reason: 'At least one selection lost.' };
    }

    const survivingPrices = bet.selections
      .filter((selection) => grades.get(selection.id) === 'WON')
      .map((selection) => selection.priceAmerican);

    if (survivingPrices.length === 0) {
      const allVoid = values.every((grade) => grade === 'VOID');
      return {
        status: allVoid ? 'VOID' : 'PUSH',
        payoutCents: bet.stakeCents,
        reason: allVoid ? 'Every selection was voided; stake returned.' : 'Stake returned.',
      };
    }

    const combined = combineParlayOdds(survivingPrices);
    const payout = payoutCents(bet.stakeCents, combined);
    const refunded = values.length - survivingPrices.length;
    return {
      status: 'WON',
      payoutCents: payout,
      reason:
        refunded === 0
          ? 'Every selection won.'
          : `${survivingPrices.length} of ${values.length} selections won; ${refunded} refunded and removed from the price.`,
    };
  }

  /* ───────────────────────────── settlement ───────────────────────── */

  /**
   * Settle one bet. Safe to call repeatedly: an already-settled bet returns
   * its recorded state rather than grading, or paying, again.
   */
  settleBet(bet: Bet, at = new Date().toISOString()): SettlementOutcome {
    if (bet.status !== 'OPEN') {
      return {
        betId: bet.id,
        status: bet.status,
        payoutCents: bet.payoutCents ?? 0,
        reason: 'Already settled.',
      };
    }
    if (this.bets.hasSettlement(bet.id)) {
      return { betId: bet.id, status: bet.status, payoutCents: 0, reason: 'A settlement record already exists.' };
    }

    const grades = new Map<string, LegGrade>();
    const confirmations: string[] = [];
    let primaryEventId = bet.selections[0]?.eventId ?? '';

    for (const selection of bet.selections) {
      const event = this.events.findEvent(selection.eventId);
      if (!event) {
        // The event is gone from the schedule: the stake is returned rather
        // than the bet being graded against data KOVR no longer holds.
        grades.set(selection.id, 'VOID');
        continue;
      }
      grades.set(selection.id, SettlementService.gradeLeg(selection, event));
      const eventConfirmedAt = event.result?.confirmedAt;
      if (eventConfirmedAt) {
        confirmations.push(eventConfirmedAt);
        primaryEventId = event.id;
      }
    }

    // The bet is settled as of its last leg to be confirmed.
    const confirmedAt = confirmations.length > 0 ? confirmations.sort().at(-1) ?? null : null;

    const combined = SettlementService.combine(bet, grades);
    if (combined.status === 'PENDING') {
      return { betId: bet.id, status: 'PENDING', payoutCents: 0, reason: combined.reason };
    }

    const outcome = combined.status;
    const payout = combined.payoutCents;

    try {
      // Grading, the settlement record, the leg statuses and the credit all
      // commit together or not at all.
      this.database.transaction(() => {
        this.bets.settle(
          bet.id,
          outcome,
          payout,
          primaryEventId,
          this.provider.name,
          confirmedAt ?? at,
          at,
        );

        for (const selection of bet.selections) {
          const grade = grades.get(selection.id);
          const legStatus: BetStatus = grade === 'UNGRADABLE' || grade === undefined ? 'VOID' : grade;
          this.bets.updateSelectionStatus(selection.id, legStatus, at);
        }

        if (payout > 0) {
          this.wallets.post(
            {
              walletId: bet.walletId,
              type: outcome === 'WON' ? 'BET_PAYOUT' : 'BET_REFUND',
              amountCents: payout,
              description:
                outcome === 'WON'
                  ? `Bet won — ${formatCents(payout)} returned`
                  : `Bet ${outcome.toLowerCase()} — ${formatCents(payout)} stake returned`,
              betId: bet.id,
              // The key is derived from the bet, so a second credit for the
              // same bet cannot be written even if this runs concurrently.
              idempotencyKey: `payout:${bet.id}`,
            },
            at,
          );
        }
      });
    } catch (error) {
      if (error instanceof DuplicateSettlementError || error instanceof DuplicateTransactionError) {
        const current = this.bets.findById(bet.id);
        return {
          betId: bet.id,
          status: current?.status ?? 'OPEN',
          payoutCents: current?.payoutCents ?? 0,
          reason: 'Settlement was already recorded; nothing paid twice.',
        };
      }
      throw error;
    }

    return { betId: bet.id, status: outcome, payoutCents: payout, reason: combined.reason };
  }

  /** Settle every open bet touching one event. */
  settleEvent(eventId: string, at = new Date().toISOString()): SettlementOutcome[] {
    return this.bets.findOpenBetsForEvent(eventId).map((bet) => this.settleBet(bet, at));
  }

  /**
   * Pull confirmed results for the competitions with bets outstanding, record
   * them, then settle whatever those results now determine.
   */
  async sweep(at = new Date().toISOString()): Promise<SweepReport> {
    const report: SweepReport = {
      eventsChecked: 0,
      resultsRecorded: 0,
      betsSettled: 0,
      betsPending: 0,
      errors: [],
    };

    const awaiting = this.events.findAwaitingResult(at);
    report.eventsChecked = awaiting.length;

    const leagueKeys = new Set<string>();
    for (const event of awaiting) {
      if (this.bets.countOpenForEvent(event.id) > 0) leagueKeys.add(event.providerLeagueKey);
    }

    for (const leagueKey of leagueKeys) {
      try {
        const results = await this.provider.getResults(leagueKey, 3);
        const byProviderId = new Map(results.map((entry) => [entry.providerEventId, entry.result]));

        for (const event of awaiting) {
          if (event.providerLeagueKey !== leagueKey) continue;
          const result = byProviderId.get(event.providerEventId);
          if (!result) continue;
          if (this.events.recordResult(event.id, result, at)) report.resultsRecorded++;
        }
      } catch (error) {
        report.errors.push(`${leagueKey}: ${RefreshManager.describe(error)}`);
      }
    }

    for (const event of awaiting) {
      for (const outcome of this.settleEvent(event.id, at)) {
        if (outcome.status === 'PENDING') report.betsPending++;
        else report.betsSettled++;
      }
    }

    return report;
  }

  /** Competitions with bets outstanding — used by the admin surface. */
  pendingLeagues(): string[] {
    const now = new Date().toISOString();
    const keys = new Set<string>();
    for (const event of this.events.findAwaitingResult(now)) {
      if (this.bets.countOpenForEvent(event.id) > 0) {
        const league = this.catalog.findLeagueByProviderKey(event.providerLeagueKey);
        keys.add(league?.name ?? event.providerLeagueKey);
      }
    }
    return [...keys];
  }
}
