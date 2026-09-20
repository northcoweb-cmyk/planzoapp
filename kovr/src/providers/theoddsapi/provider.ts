/**
 * `SportsDataProvider` backed by The Odds API v4.
 *
 * All network access for sports data flows through this class. It holds a
 * short-lived catalogue cache so that resolving a competition key does not
 * cost a request on every call.
 */

import type {
  EventQuery,
  ProviderHealth,
  SportsDataProvider,
} from '../SportsDataProvider.js';
import { ProviderError } from '../SportsDataProvider.js';
import type { EventResult, EventStatus, EventWithMarkets, League, SportEvent } from '../../domain/types.js';
import { CORE_MARKET_KEYS } from '../../domain/markets.js';
import { categoryForGroup, leagueEditorialFor } from '../../domain/catalog.js';
import { config } from '../../config/env.js';
import type { RequestLog } from '../../runtime/cache.js';
import { TheOddsApiClient } from './client.js';
import {
  PROVIDER_NAME,
  normaliseEvent,
  normaliseEventWithMarkets,
  normaliseLeague,
  normaliseResult,
  statusFromScores,
} from './normalize.js';
import { filterValid, isRawEvent, isRawScoreEvent, isRawSport } from './raw.js';

/** The provider's key namespaces map cleanly onto its own sport groups. */
const KEY_PREFIX_TO_GROUP: ReadonlyArray<readonly [string, string]> = [
  ['americanfootball_', 'American Football'],
  ['basketball_', 'Basketball'],
  ['baseball_', 'Baseball'],
  ['icehockey_', 'Ice Hockey'],
  ['soccer_', 'Soccer'],
  ['tennis_', 'Tennis'],
  ['golf_', 'Golf'],
  ['motorsport_', 'Motor Sport'],
  ['mma_', 'Mixed Martial Arts'],
  ['boxing_', 'Boxing'],
  ['cricket_', 'Cricket'],
  ['rugbyleague_', 'Rugby League'],
  ['rugbyunion_', 'Rugby Union'],
  ['aussierules_', 'Aussie Rules'],
  ['lacrosse_', 'Lacrosse'],
];

const CATALOGUE_TTL_MS = 6 * 60 * 60 * 1000;

export class TheOddsApiProvider implements SportsDataProvider {
  readonly name = PROVIDER_NAME;

  private readonly client: TheOddsApiClient;
  private catalogue: Map<string, League> = new Map();
  private catalogueFetchedAt = 0;

  constructor(log: RequestLog) {
    this.client = new TheOddsApiClient(log);
  }

  isConfigured(): boolean {
    return this.client.isConfigured();
  }

  async getLeagues(): Promise<League[]> {
    const response = await this.client.get<unknown>('/sports/', { all: 'false' });
    const leagues = filterValid(response.data, isRawSport)
      .map(normaliseLeague)
      .filter((league): league is League => league !== null);

    this.catalogue = new Map(leagues.map((league) => [league.providerKey, league]));
    this.catalogueFetchedAt = Date.now();
    return leagues;
  }

  /**
   * Resolve a competition key to its normalised league.
   *
   * Falls back to deriving the grouping from the key's own namespace when the
   * catalogue has not been fetched. That is a deterministic reading of the
   * provider's key scheme, not an invention: it affects only how the league
   * is grouped and labelled, never any event, price or result.
   */
  private async resolveLeague(providerKey: string): Promise<League> {
    const cached = this.catalogue.get(providerKey);
    if (cached && Date.now() - this.catalogueFetchedAt < CATALOGUE_TTL_MS) return cached;

    if (Date.now() - this.catalogueFetchedAt >= CATALOGUE_TTL_MS) {
      try {
        await this.getLeagues();
      } catch {
        // A catalogue refresh failure must not block a fixture request.
      }
      const refreshed = this.catalogue.get(providerKey);
      if (refreshed) return refreshed;
    }
    if (cached) return cached;

    const group = KEY_PREFIX_TO_GROUP.find(([prefix]) => providerKey.startsWith(prefix))?.[1] ?? 'Other';
    const category = categoryForGroup(group);
    const editorial = leagueEditorialFor(providerKey, providerKey);
    return {
      id: editorial.id,
      providerKey,
      categoryId: category.id,
      name: editorial.shortName,
      shortName: editorial.shortName,
      description: '',
      priority: editorial.priority,
      providerActive: true,
      outrightsOnly: false,
      seasonState: 'UNKNOWN',
      liveEventCount: 0,
      upcomingEventCount: 0,
    };
  }

  async getEvents(query: EventQuery): Promise<SportEvent[]> {
    const league = await this.resolveLeague(query.leagueKey);
    const response = await this.client.get<unknown>(
      `/sports/${encodeURIComponent(query.leagueKey)}/events/`,
      { dateFormat: 'iso' },
    );
    const now = Date.now();
    return filterValid(response.data, isRawEvent)
      .map((raw) => normaliseEvent(raw, league, response.fetchedAt, now))
      .filter((event): event is SportEvent => event !== null);
  }

  async getEventsWithOdds(query: EventQuery): Promise<EventWithMarkets[]> {
    const league = await this.resolveLeague(query.leagueKey);
    const settings = config();
    const markets = (query.markets ?? CORE_MARKET_KEYS).join(',');

    const response = await this.client.get<unknown>(
      `/sports/${encodeURIComponent(query.leagueKey)}/odds/`,
      {
        regions: settings.oddsRegions,
        markets,
        oddsFormat: 'american',
        dateFormat: 'iso',
      },
    );

    const now = Date.now();
    return filterValid(response.data, isRawEvent)
      .map((raw) =>
        normaliseEventWithMarkets(raw, league, settings.preferredBookmaker, response.fetchedAt, now),
      )
      .filter((entry): entry is EventWithMarkets => entry !== null);
  }

  async getEvent(leagueKey: string, providerEventId: string): Promise<EventWithMarkets | null> {
    const league = await this.resolveLeague(leagueKey);
    const settings = config();

    try {
      const response = await this.client.get<unknown>(
        `/sports/${encodeURIComponent(leagueKey)}/events/${encodeURIComponent(providerEventId)}/odds/`,
        {
          regions: settings.oddsRegions,
          markets: CORE_MARKET_KEYS.join(','),
          oddsFormat: 'american',
          dateFormat: 'iso',
        },
      );
      if (!isRawEvent(response.data)) return null;
      return normaliseEventWithMarkets(
        response.data,
        league,
        settings.preferredBookmaker,
        response.fetchedAt,
      );
    } catch (error) {
      if (error instanceof ProviderError && error.code === 'NOT_FOUND') return null;
      throw error;
    }
  }

  async getEventStatuses(leagueKey: string): Promise<Array<{ providerEventId: string; status: EventStatus }>> {
    const response = await this.client.get<unknown>(
      `/sports/${encodeURIComponent(leagueKey)}/scores/`,
      { daysFrom: '1', dateFormat: 'iso' },
    );
    const now = Date.now();
    return filterValid(response.data, isRawScoreEvent).map((raw) => ({
      providerEventId: raw.id,
      status: statusFromScores(raw, now),
    }));
  }

  async getResults(
    leagueKey: string,
    daysBack = 3,
  ): Promise<Array<{ providerEventId: string; result: EventResult }>> {
    const clamped = Math.min(3, Math.max(1, Math.trunc(daysBack)));
    const response = await this.client.get<unknown>(
      `/sports/${encodeURIComponent(leagueKey)}/scores/`,
      { daysFrom: String(clamped), dateFormat: 'iso' },
    );

    const results: Array<{ providerEventId: string; result: EventResult }> = [];
    for (const raw of filterValid(response.data, isRawScoreEvent)) {
      const result = normaliseResult(raw, leagueKey, response.fetchedAt);
      // normaliseResult returns null unless the provider confirmed completion
      // and published readable scores. Those events simply stay unsettled.
      if (result) results.push({ providerEventId: raw.id, result });
    }
    return results;
  }

  async health(): Promise<ProviderHealth> {
    const quota = this.client.getQuota();
    const settings = config();
    return {
      name: this.name,
      configured: this.isConfigured(),
      reachable: this.client.getLastSuccessAt() !== null && this.client.getLastError() === null,
      lastSuccessAt: this.client.getLastSuccessAt(),
      lastErrorAt: this.client.getLastErrorAt(),
      lastError: this.client.getLastError(),
      quota: {
        remaining: quota.remaining,
        used: quota.used,
        lastHourRequests: this.client.requestsInLastHour(),
        hourlyBudget: settings.hourlyRequestBudget,
      },
    };
  }
}
