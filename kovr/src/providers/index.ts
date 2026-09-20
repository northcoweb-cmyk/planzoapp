/**
 * Provider selection.
 *
 * When no key is configured, KOVR installs a provider that reports every call
 * as unavailable rather than one that returns invented data. The UI then
 * shows its data-unavailable state, which is the truth.
 */

import type { Database } from '../store/db.js';
import { config } from '../config/env.js';
import type { EventQuery, ProviderHealth, SportsDataProvider } from './SportsDataProvider.js';
import { ProviderError } from './SportsDataProvider.js';
import type { EventResult, EventStatus, EventWithMarkets, League, SportEvent } from '../domain/types.js';
import { TheOddsApiProvider } from './theoddsapi/provider.js';

const NOT_CONFIGURED =
  'No sports data provider is configured. Set KOVR_ODDS_API_KEY to enable live sports data.';

/** Fails every call loudly. It never returns an empty list, which would read as "no events today". */
export class UnconfiguredProvider implements SportsDataProvider {
  readonly name = 'unconfigured';

  isConfigured(): boolean {
    return false;
  }

  private fail(): never {
    throw new ProviderError('NOT_CONFIGURED', NOT_CONFIGURED);
  }

  getLeagues(): Promise<League[]> {
    return this.fail();
  }
  getEvents(_query: EventQuery): Promise<SportEvent[]> {
    return this.fail();
  }
  getEventsWithOdds(_query: EventQuery): Promise<EventWithMarkets[]> {
    return this.fail();
  }
  getEvent(_leagueKey: string, _providerEventId: string): Promise<EventWithMarkets | null> {
    return this.fail();
  }
  getEventStatuses(_leagueKey: string): Promise<Array<{ providerEventId: string; status: EventStatus }>> {
    return this.fail();
  }
  getResults(_leagueKey: string, _daysBack?: number): Promise<Array<{ providerEventId: string; result: EventResult }>> {
    return this.fail();
  }

  async health(): Promise<ProviderHealth> {
    return {
      name: this.name,
      configured: false,
      reachable: false,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastError: NOT_CONFIGURED,
      quota: { remaining: null, used: null, lastHourRequests: 0, hourlyBudget: 0 },
    };
  }
}

let active: SportsDataProvider | null = null;

export function provider(database: Database): SportsDataProvider {
  if (!active) {
    active = config().oddsApiKey === null ? new UnconfiguredProvider() : new TheOddsApiProvider(database);
  }
  return active;
}

/** Test and admin helper: install a specific provider implementation. */
export function useProvider(next: SportsDataProvider | null): void {
  active = next;
}

export { ProviderError } from './SportsDataProvider.js';
export type { SportsDataProvider, ProviderHealth } from './SportsDataProvider.js';
