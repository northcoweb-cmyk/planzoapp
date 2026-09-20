/**
 * KOVR money primitives.
 *
 * Every monetary value in KOVR is an integer number of cents. Floating point
 * dollars are never stored, never summed, and never used to decide a payout —
 * a wallet that drifts by a cent is a broken wallet.
 *
 * All simulated. KOVR never touches real funds.
 */

/** An integer number of cents. Negative values represent debits. */
export type Cents = number;

export class MoneyError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'MoneyError';
    this.code = code;
  }
}

/** Largest amount KOVR will accept anywhere: $10,000,000.00. */
export const MAX_CENTS = 1_000_000_000;

export function isCents(value: unknown): value is Cents {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

/** Throws unless `value` is a safe integer within KOVR's supported range. */
export function assertCents(value: unknown, label = 'amount'): asserts value is Cents {
  if (!isCents(value)) {
    throw new MoneyError('NOT_INTEGER_CENTS', `${label} must be an integer number of cents`);
  }
  if (Math.abs(value) > MAX_CENTS) {
    throw new MoneyError('OUT_OF_RANGE', `${label} is outside the supported range`);
  }
}

/**
 * Round half away from zero — the convention used for commercial amounts.
 * `Math.round` rounds half toward +Infinity, which is asymmetric for debits.
 */
export function roundHalfAwayFromZero(value: number): number {
  if (!Number.isFinite(value)) {
    throw new MoneyError('NOT_FINITE', 'cannot round a non-finite value');
  }
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/**
 * Exactly scale a plain decimal string to cents using integer arithmetic,
 * rounding half away from zero. Returns null for anything not in plain
 * `-?digits[.digits]` form (exponential notation, NaN, Infinity).
 */
function decimalStringToCents(text: string): Cents | null {
  const match = /^(-?)(\d+)(?:\.(\d*))?$/.exec(text);
  if (!match) return null;

  const [, sign, whole = '0', fraction = ''] = match;
  const padded = fraction.padEnd(3, '0');
  const hundredths = Number(whole) * 100 + Number(padded.slice(0, 2));
  // Half rounds away from zero, so a third digit of 5 always rounds up in
  // magnitude regardless of what follows it.
  const thousandths = Number(padded[2] ?? '0');
  const magnitude = hundredths + (thousandths >= 5 ? 1 : 0);
  return sign === '-' ? -magnitude : magnitude;
}

/**
 * Convert whole dollars (as a number) to cents.
 *
 * Scales through the number's shortest round-trip decimal representation
 * rather than multiplying by 100, so `19.99` does not become 1998.9999… and
 * `1.005` rounds up the way the person who typed it expects — its binary
 * value is really 1.00499999999999989, which naive `* 100` rounds down.
 */
export function dollarsToCents(dollars: number): Cents {
  if (!Number.isFinite(dollars)) {
    throw new MoneyError('NOT_FINITE', 'dollars must be a finite number');
  }
  const exact = decimalStringToCents(dollars.toString());
  const cents = exact ?? roundHalfAwayFromZero(dollars * 100);
  assertCents(cents, 'dollars');
  return cents;
}

export function centsToDollars(cents: Cents): number {
  assertCents(cents);
  return cents / 100;
}

/**
 * Parse user input ("100", "$1,250.50", "12.5") into cents.
 *
 * Deliberately strict: anything that is not unambiguously an amount is
 * rejected rather than coerced, because a silently coerced stake is a wrong
 * stake. Accepts at most two decimal places.
 */
export function parseAmountToCents(input: string | number): Cents {
  if (typeof input === 'number') return dollarsToCents(input);
  if (typeof input !== 'string') {
    throw new MoneyError('INVALID_AMOUNT', 'amount must be a string or number');
  }

  const cleaned = input.trim().replace(/[$\s,]/g, '');
  if (cleaned === '') throw new MoneyError('INVALID_AMOUNT', 'amount is empty');

  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) {
    throw new MoneyError('INVALID_AMOUNT', 'amount must be a number with at most two decimals');
  }

  const [, sign, whole, fraction = ''] = match;
  const cents = Number(whole ?? '0') * 100 + Number(fraction.padEnd(2, '0'));
  const signed = sign === '-' ? -cents : cents;
  assertCents(signed, 'amount');
  return signed;
}

/** Sum a list of cent amounts, asserting each one. Used by ledger reconciliation. */
export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const value of values) {
    assertCents(value);
    total += value;
  }
  assertCents(total, 'total');
  return total;
}

/**
 * Multiply an amount by a ratio and round to whole cents.
 * The only sanctioned way to scale money in KOVR.
 */
export function scaleCents(cents: Cents, ratio: number): Cents {
  assertCents(cents);
  if (!Number.isFinite(ratio)) {
    throw new MoneyError('NOT_FINITE', 'ratio must be finite');
  }
  const scaled = roundHalfAwayFromZero(cents * ratio);
  assertCents(scaled, 'scaled amount');
  return scaled;
}

const US_MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "$1,234.56" — always two decimals, always signed naturally. */
export function formatCents(cents: Cents): string {
  assertCents(cents);
  return US_MONEY.format(cents / 100);
}

/** "+$100.00" / "-$100.00" — for ledger rows where direction is the point. */
export function formatCentsSigned(cents: Cents): string {
  assertCents(cents);
  const body = US_MONEY.format(Math.abs(cents) / 100);
  return cents < 0 ? `-${body}` : `+${body}`;
}
