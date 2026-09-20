/**
 * The provider installed when no key is configured.
 *
 * Fails every call loudly. It never returns an empty list, which would read
 * as "nothing on today" — the interface must be able to tell "we could not
 * ask" apart from "there is nothing".
 */

import type { EventQuery, ProviderHealth, SportsDataProvider } from './SportsDataProvider.js';
import { ProviderError } from './SportsDataProvider.js';
import type { EventResult, EventStatus, EventWithMarkets, League, SportEvent } from '../domain/types.js';

const NOT_CONFIGURED = 'No sports data provider is configured. Set KOVR_ODDS_API_KEY to enable live sports data.';

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
  getResults(
    _leagueKey: string,
    _daysBack?: number,
  ): Promise<Array<{ providerEventId: string; result: EventResult }>> {
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
