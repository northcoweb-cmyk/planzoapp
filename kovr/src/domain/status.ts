/** Event status rules: what each status means and what it permits. */

import type { EventStatus, Freshness, DataSource } from './types.js';

const ALL: readonly EventStatus[] = [
  'UPCOMING',
  'LIVE',
  'PAUSED',
  'FINAL',
  'CANCELLED',
  'POSTPONED',
  'UNKNOWN',
];

export function isEventStatus(value: unknown): value is EventStatus {
  return typeof value === 'string' && (ALL as readonly string[]).includes(value);
}

/**
 * Whether KOVR will accept a new bet on an event in this status.
 *
 * Only `UPCOMING` qualifies. `UNKNOWN` deliberately does not: when KOVR
 * cannot tell whether an event has started, it declines rather than guesses.
 * In-play betting is not offered, so `LIVE` is closed too.
 */
export function acceptsNewBets(status: EventStatus): boolean {
  return status === 'UPCOMING';
}

/** Whether the event has reached a state a settlement could be drawn from. */
export function isTerminal(status: EventStatus): boolean {
  return status === 'FINAL' || status === 'CANCELLED';
}

/** Statuses that void outstanding bets rather than grading them. */
export function voidsOutstandingBets(status: EventStatus): boolean {
  return status === 'CANCELLED';
}

export function statusLabel(status: EventStatus): string {
  switch (status) {
    case 'UPCOMING':
      return 'Upcoming';
    case 'LIVE':
      return 'Live';
    case 'PAUSED':
      return 'Paused';
    case 'FINAL':
      return 'Final';
    case 'CANCELLED':
      return 'Cancelled';
    case 'POSTPONED':
      return 'Postponed';
    case 'UNKNOWN':
      return 'Status unavailable';
  }
}

/* ───────────────────────────── freshness ───────────────────────────── */

/**
 * How old a payload may be before KOVR labels it as possibly outdated.
 * Live data ages fastest; a schedule can be minutes old and still be true.
 */
export const STALE_AFTER_MS = {
  liveOdds: 90_000,
  liveScores: 60_000,
  upcomingOdds: 10 * 60_000,
  schedule: 30 * 60_000,
  catalog: 24 * 60 * 60_000,
} as const;

export type FreshnessClass = keyof typeof STALE_AFTER_MS;

export function buildFreshness(
  source: DataSource,
  lastUpdatedAt: string | null,
  freshnessClass: FreshnessClass,
  error: string | null = null,
  now: number = Date.now(),
): Freshness {
  if (!lastUpdatedAt) {
    return { source, lastUpdatedAt: null, ageMs: null, stale: source !== 'live', error };
  }
  const ageMs = Math.max(0, now - Date.parse(lastUpdatedAt));
  return {
    source,
    lastUpdatedAt,
    ageMs,
    stale: source === 'unavailable' || ageMs > STALE_AFTER_MS[freshnessClass],
    error,
  };
}
