/**
 * KOVR American-odds engine.
 *
 * This is the single source of truth for every price calculation in the
 * application: the betslip, the bet record, and the settlement engine all
 * call into here. Nothing anywhere else is allowed to compute a payout.
 *
 * Simulated money only.
 */

import type { Cents } from './money.js';
import { assertCents, roundHalfAwayFromZero, MoneyError } from './money.js';

/**
 * American ("moneyline") odds. Always an integer, never zero, and never
 * between -99 and +99 — those values do not exist in American format.
 */
export type AmericanOdds = number;

export class OddsError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'OddsError';
    this.code = code;
  }
}

export function isValidAmericanOdds(value: unknown): value is AmericanOdds {
  return typeof value === 'number' && Number.isInteger(value) && Math.abs(value) >= 100;
}

export function assertAmericanOdds(value: unknown): asserts value is AmericanOdds {
  if (!isValidAmericanOdds(value)) {
    throw new OddsError('INVALID_ODDS', `"${String(value)}" is not valid American odds`);
  }
}

/**
 * Parse odds as a provider or a user might express them: 150, "+150", "-110".
 * Never invents a value — unparseable input throws.
 */
export function parseAmericanOdds(input: string | number): AmericanOdds {
  const value = typeof input === 'string' ? Number(input.trim().replace(/^\+/, '')) : input;
  assertAmericanOdds(value);
  return value;
}

/** "+125" / "-110" — the way a sportsbook shows a price. */
export function formatAmericanOdds(odds: AmericanOdds): string {
  assertAmericanOdds(odds);
  return odds > 0 ? `+${odds}` : String(odds);
}

/**
 * Profit (NOT total payout) on a winning stake.
 *
 *   positive odds:  profit = stake x (odds / 100)
 *   negative odds:  profit = stake x (100 / |odds|)
 *
 * Computed in integer cents and rounded half away from zero.
 */
export function profitCents(stakeCents: Cents, odds: AmericanOdds): Cents {
  assertCents(stakeCents, 'stake');
  assertAmericanOdds(odds);
  if (stakeCents < 0) {
    throw new MoneyError('NEGATIVE_STAKE', 'stake cannot be negative');
  }

  const raw = odds > 0 ? (stakeCents * odds) / 100 : (stakeCents * 100) / Math.abs(odds);
  const profit = roundHalfAwayFromZero(raw);
  assertCents(profit, 'profit');
  return profit;
}

/** Total returned on a win: the original stake plus the profit. */
export function payoutCents(stakeCents: Cents, odds: AmericanOdds): Cents {
  const total = stakeCents + profitCents(stakeCents, odds);
  assertCents(total, 'payout');
  return total;
}

/** Decimal representation of a price, e.g. -110 -> 1.909090..., +150 -> 2.5 */
export function toDecimalOdds(odds: AmericanOdds): number {
  assertAmericanOdds(odds);
  return odds > 0 ? odds / 100 + 1 : 100 / Math.abs(odds) + 1;
}

/**
 * Convert a decimal price from a provider back into American format.
 *
 * Note that decimal 2.0 is even money, which American format writes as +100;
 * -100 is the same price and normalises to +100 on the way back. Every other
 * price round-trips to itself.
 */
export function fromDecimalOdds(decimal: number): AmericanOdds {
  if (!Number.isFinite(decimal) || decimal <= 1) {
    throw new OddsError('INVALID_DECIMAL', 'decimal odds must be greater than 1');
  }
  const american =
    decimal >= 2
      ? roundHalfAwayFromZero((decimal - 1) * 100)
      : roundHalfAwayFromZero(-100 / (decimal - 1));
  assertAmericanOdds(american);
  return american;
}

/**
 * Implied probability including the bookmaker's margin, in the range (0, 1).
 * Display only — KOVR never uses this to price anything.
 */
export function impliedProbability(odds: AmericanOdds): number {
  assertAmericanOdds(odds);
  return odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
}

/**
 * Combined price of a parlay, derived from its legs' decimal prices.
 * Kept here so multi-leg slips can never grow their own arithmetic.
 */
export function combineParlayOdds(legs: readonly AmericanOdds[]): AmericanOdds {
  if (legs.length === 0) {
    throw new OddsError('EMPTY_PARLAY', 'a parlay needs at least one leg');
  }
  if (legs.length === 1) {
    const only = legs[0];
    assertAmericanOdds(only);
    return only;
  }
  const decimal = legs.reduce<number>((acc, leg) => acc * toDecimalOdds(leg), 1);
  return fromDecimalOdds(decimal);
}

/**
 * True when the two prices differ — the trigger for the odds-change prompt.
 * Accepts the string form because the price the client echoes back arrives
 * over JSON and must be compared, not trusted.
 */
export function oddsChanged(shown: AmericanOdds | string, current: AmericanOdds | string): boolean {
  return parseAmericanOdds(shown) !== parseAmericanOdds(current);
}

/**
 * Whether a price moved in the bettor's favour. Used only to word the
 * odds-change prompt ("improved" vs "moved against you"); the user confirms
 * either way.
 */
export function isBetterForBettor(previous: AmericanOdds, next: AmericanOdds): boolean {
  return toDecimalOdds(next) > toDecimalOdds(previous);
}
