/**
 * A scripted `SportsDataProvider` for tests.
 *
 * DEVELOPMENT FIXTURE ONLY. Nothing in `src/` imports this file, and the
 * running application never sees it. Production data comes exclusively from
 * a real provider; this exists so settlement, odds movement and failure
 * handling can be driven deterministically.
 */

import type {
  EventQuery,
  ProviderHealth,
  SportsDataProvider,
} from '../../src/providers/SportsDataProvider.js';
import type { ProviderError } from '../../src/providers/SportsDataProvider.js';
import type {
  EventResult,
  EventStatus,
  EventWithMarkets,
  League,
  Market,
  SportEvent,
} from '../../src/domain/types.js';
import { internalEventId, participantIdFor, selectionIdFor } from '../../src/domain/identity.js';

export const UFC_KEY = 'mma_mixed_martial_arts';
export const NFL_KEY = 'americanfootball_nfl';

export const UFC_LEAGUE: League = {
  id: 'ufc',
  providerKey: UFC_KEY,
  categoryId: 'combat',
  name: 'MMA',
  shortName: 'UFC',
  description: 'Mixed Martial Arts',
  priority: 1,
  providerActive: true,
  outrightsOnly: false,
  seasonState: 'UNKNOWN',
  liveEventCount: 0,
  upcomingEventCount: 0,
};

export const NFL_LEAGUE: League = {
  id: 'nfl',
  providerKey: NFL_KEY,
  categoryId: 'football',
  name: 'NFL',
  shortName: 'NFL',
  description: 'US Football',
  priority: 1,
  providerActive: true,
  outrightsOnly: false,
  seasonState: 'UNKNOWN',
  liveEventCount: 0,
  upcomingEventCount: 0,
};

export function isoIn(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

interface BuildEventOptions {
  providerEventId: string;
  league: League;
  competitors: [string, string];
  startTime: string;
  status?: EventStatus;
}

export function buildEvent(options: BuildEventOptions): SportEvent {
  const { providerEventId, league, competitors, startTime } = options;
  const [away, home] = competitors;
  const neutral = league.categoryId === 'combat';

  return {
    id: internalEventId(league.providerKey, providerEventId),
    providerEventId,
    leagueId: league.id,
    categoryId: league.categoryId,
    providerLeagueKey: league.providerKey,
    name: neutral ? `${away} vs ${home}` : `${away} @ ${home}`,
    eventTitle: null,
    participants: [
      {
        externalId: participantIdFor(league.providerKey, away),
        name: away,
        abbreviation: null,
        role: neutral ? 'NEUTRAL' : 'AWAY',
        imageUrl: null,
        score: null,
      },
      {
        externalId: participantIdFor(league.providerKey, home),
        name: home,
        abbreviation: null,
        role: neutral ? 'NEUTRAL' : 'HOME',
        imageUrl: null,
        score: null,
      },
    ],
    startTime,
    status: options.status ?? 'UPCOMING',
    periodLabel: null,
    venue: null,
    result: null,
    fight: neutral
      ? {
          weightClass: null,
          isMainEvent: false,
          cardSegment: null,
          scheduledRounds: null,
          method: null,
          endRound: null,
          endTime: null,
        }
      : null,
    imageUrl: null,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function moneylineMarket(
  event: SportEvent,
  prices: [number, number],
  updatedAt = new Date().toISOString(),
): Market {
  const selections = event.participants.map((participant, index) => ({
    id: selectionIdFor('h2h', participant.name, null),
    name: participant.name,
    participantExternalId: participant.externalId,
    line: null,
    price: prices[index] ?? 100,
    bookmakerKey: 'kovr_test_book',
    bookmakerName: 'Test Book',
    priceUpdatedAt: updatedAt,
  }));

  return { key: 'h2h', name: 'Moneyline', kind: 'MONEYLINE', selections, lastUpdatedAt: updatedAt };
}

export function totalsMarket(event: SportEvent, line: number, prices: [number, number]): Market {
  const updatedAt = new Date().toISOString();
  return {
    key: 'totals',
    name: 'Total',
    kind: 'TOTAL',
    lastUpdatedAt: updatedAt,
    selections: [
      {
        id: selectionIdFor('totals', 'Over', line),
        name: 'Over',
        participantExternalId: null,
        line,
        price: prices[0],
        bookmakerKey: 'kovr_test_book',
        bookmakerName: 'Test Book',
        priceUpdatedAt: updatedAt,
      },
      {
        id: selectionIdFor('totals', 'Under', line),
        name: 'Under',
        participantExternalId: null,
        line,
        price: prices[1],
        bookmakerKey: 'kovr_test_book',
        bookmakerName: 'Test Book',
        priceUpdatedAt: updatedAt,
      },
    ],
  };
}

export function spreadMarket(event: SportEvent, lines: [number, number], prices: [number, number]): Market {
  const updatedAt = new Date().toISOString();
  return {
    key: 'spreads',
    name: 'Spread',
    kind: 'SPREAD',
    lastUpdatedAt: updatedAt,
    selections: event.participants.map((participant, index) => ({
      id: selectionIdFor('spreads', participant.name, lines[index] ?? 0),
      name: participant.name,
      participantExternalId: participant.externalId,
      line: lines[index] ?? 0,
      price: prices[index] ?? -110,
      bookmakerKey: 'kovr_test_book',
      bookmakerName: 'Test Book',
      priceUpdatedAt: updatedAt,
    })),
  };
}

/** A provider whose responses the test controls outright. */
export class FakeProvider implements SportsDataProvider {
  readonly name = 'fake-provider';

  leagues: League[] = [UFC_LEAGUE, NFL_LEAGUE];
  byLeague = new Map<string, EventWithMarkets[]>();
  results = new Map<string, Array<{ providerEventId: string; result: EventResult }>>();
  statuses = new Map<string, Array<{ providerEventId: string; status: EventStatus }>>();

  /** When set, every call throws it — used to exercise outage handling. */
  failure: ProviderError | null = null;
  calls = { leagues: 0, events: 0, odds: 0, scores: 0, results: 0 };

  setLeagueEvents(leagueKey: string, entries: EventWithMarkets[]): void {
    this.byLeague.set(leagueKey, entries);
  }

  setResults(leagueKey: string, entries: Array<{ providerEventId: string; result: EventResult }>): void {
    this.results.set(leagueKey, entries);
  }

  isConfigured(): boolean {
    return true;
  }

  private guard(): void {
    if (this.failure) throw this.failure;
  }

  async getLeagues(): Promise<League[]> {
    this.calls.leagues++;
    this.guard();
    return this.leagues;
  }

  async getEvents(query: EventQuery): Promise<SportEvent[]> {
    this.calls.events++;
    this.guard();
    return (this.byLeague.get(query.leagueKey) ?? []).map((entry) => entry.event);
  }

  async getEventsWithOdds(query: EventQuery): Promise<EventWithMarkets[]> {
    this.calls.odds++;
    this.guard();
    return this.byLeague.get(query.leagueKey) ?? [];
  }

  async getEvent(leagueKey: string, providerEventId: string): Promise<EventWithMarkets | null> {
    this.guard();
    return (
      (this.byLeague.get(leagueKey) ?? []).find((entry) => entry.event.providerEventId === providerEventId) ?? null
    );
  }

  async getEventStatuses(leagueKey: string): Promise<Array<{ providerEventId: string; status: EventStatus }>> {
    this.calls.scores++;
    this.guard();
    return this.statuses.get(leagueKey) ?? [];
  }

  async getResults(leagueKey: string): Promise<Array<{ providerEventId: string; result: EventResult }>> {
    this.calls.results++;
    this.guard();
    return this.results.get(leagueKey) ?? [];
  }

  async health(): Promise<ProviderHealth> {
    return {
      name: this.name,
      configured: true,
      reachable: this.failure === null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastError: this.failure?.message ?? null,
      quota: { remaining: null, used: null, lastHourRequests: 0, hourlyBudget: 0 },
    };
  }
}

/** Build a confirmed result where `winnerName` beat the other competitor. */
export function resultFor(
  event: SportEvent,
  winnerName: string | null,
  scores: [number, number] = [1, 0],
  confirmedAt = new Date().toISOString(),
): EventResult {
  const entries = event.participants.map((participant, index) => ({
    externalId: participant.externalId,
    score: scores[index] ?? 0,
  }));
  const winner =
    winnerName === null
      ? null
      : participantIdFor(event.providerLeagueKey, winnerName);
  return {
    winnerExternalId: winner,
    isDraw: winnerName === null,
    scores: entries,
    confirmedAt,
    method: null,
  };
}
