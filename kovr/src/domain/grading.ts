/**
 * Bet grading — pure, shared by every runtime.
 *
 * This module decides what a bet is worth once a result is known. It has no
 * storage, no clock and no I/O, so the browser and the server grade a bet
 * identically. Anything that needs a database lives elsewhere.
 */

import type { Bet, BetSelection, BetStatus, SportEvent } from './types.js';

/** The only part of an event that grading reads. */
export type SettlementFact = Pick<SportEvent, 'status' | 'result'>;
import type { Cents } from '../core/money.js';
import { combineParlayOdds, payoutCents } from '../core/odds.js';
import { describeMarket } from './markets.js';

/** A single leg's grade. `UNGRADABLE` means "not enough confirmed data yet". */
export type LegGrade = 'WON' | 'LOST' | 'PUSH' | 'VOID' | 'UNGRADABLE';

/** Every bet status except OPEN — what a settled bet may become. */
export type SettledStatus = Exclude<BetStatus, 'OPEN'>;

const DRAW_NAMES = new Set(['draw', 'tie']);

/**
 * Grade one leg against its event.
 *
 * Returns `UNGRADABLE` whenever the confirmed data does not actually
 * determine the outcome — an unpriced prop, a spread with no scores, a
 * market KOVR cannot grade. Those bets stay open rather than being guessed
 * at in either direction.
 */
export function gradeLeg(selection: BetSelection, event: SettlementFact): LegGrade {
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
export function combineGrades(
  bet: Pick<Bet, 'stakeCents' | 'selections'>,
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
