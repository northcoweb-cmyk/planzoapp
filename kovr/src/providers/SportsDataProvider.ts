/**
 * The contract every sports-data source must satisfy.
 *
 * Application code depends on this interface and on `src/domain/types.ts` —
 * never on a vendor's response shape. Adding a second provider, or replacing
 * the first, means writing one new implementation of this interface.
 */

import type { EventResult, EventStatus, EventWithMarkets, League, SportEvent } from '../domain/types.js';

export type ProviderErrorCode =
  | 'NOT_CONFIGURED'
  | 'AUTH_FAILED'
  | 'RATE_LIMITED'
  | 'BUDGET_EXCEEDED'
  | 'NETWORK'
  | 'BAD_RESPONSE'
  | 'NOT_FOUND'
  | 'UNSUPPORTED';

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly status: number | null;
  /** True when trying the same call again later could plausibly succeed. */
  readonly retryable: boolean;

  constructor(code: ProviderErrorCode, message: string, status: number | null = null) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.status = status;
    this.retryable = code === 'NETWORK' || code === 'RATE_LIMITED' || code === 'BUDGET_EXCEEDED';
  }
}

/** What the provider reports about its own quota, for the admin surface. */
export interface ProviderQuota {
  remaining: number | null;
  used: number | null;
  /** Requests KOVR itself has made in the last hour. */
  lastHourRequests: number;
  hourlyBudget: number;
}

export interface ProviderHealth {
  name: string;
  configured: boolean;
  reachable: boolean;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  quota: ProviderQuota;
}

export interface EventQuery {
  /** Provider league key. Required — KOVR never fans out across every league. */
  leagueKey: string;
  /** Include markets and prices. Costs more quota than a bare schedule. */
  withOdds?: boolean;
  /** Market keys to request; defaults to the core three. */
  markets?: readonly string[];
}

/**
 * A sports-data source.
 *
 * Every method either returns normalised domain data or throws a
 * `ProviderError`. No implementation may return placeholder data to paper
 * over a failure: an empty list means "the provider reported nothing", and a
 * throw means "KOVR does not know". The difference matters, because the UI
 * shows an honest unavailable state for the second and never for the first.
 */
export interface SportsDataProvider {
  readonly name: string;

  /** Whether credentials are present. False disables every network call. */
  isConfigured(): boolean;

  /** The provider's full catalogue of competitions, normalised. */
  getLeagues(): Promise<League[]>;

  /** Scheduled events for one competition, without prices. */
  getEvents(query: EventQuery): Promise<SportEvent[]>;

  /** Events for one competition together with their priced markets. */
  getEventsWithOdds(query: EventQuery): Promise<EventWithMarkets[]>;

  /** A single event with its markets, or null when the provider has none. */
  getEvent(leagueKey: string, providerEventId: string): Promise<EventWithMarkets | null>;

  /** Current status for recent and in-flight events in one competition. */
  getEventStatuses(leagueKey: string): Promise<Array<{ providerEventId: string; status: EventStatus }>>;

  /**
   * Confirmed final results only.
   *
   * Implementations must return a result exclusively when the provider states
   * the event is complete. A start time in the past is never sufficient.
   */
  getResults(leagueKey: string, daysBack?: number): Promise<Array<{ providerEventId: string; result: EventResult }>>;

  health(): Promise<ProviderHealth>;
}
