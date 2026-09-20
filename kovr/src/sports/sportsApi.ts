/**
 * The sports surface — stateless.
 *
 * Every read goes to the provider through the refresh manager, which
 * deduplicates concurrent callers, serves a fresh in-process cache without a
 * network call, and serves a stale one, clearly labelled, when the provider
 * is unreachable. Nothing is persisted, so this runs identically as a
 * long-lived server or as a serverless function behind a CDN.
 */

import type {
  Envelope,
  EventWithMarkets,
  Freshness,
  League,
  Market,
  SportCategory,
  SportEvent,
} from '../domain/types.js';
import type { SettlementFact } from '../domain/grading.js';
import { buildFreshness } from '../domain/status.js';
import { categoryById, deriveSeasonState, hasCurrentContent, FEATURED_LEAGUE_IDS } from '../domain/catalog.js';
import { decodeEventId } from '../domain/identity.js';
import type { SportsDataProvider } from '../providers/SportsDataProvider.js';
import { RefreshManager } from '../services/refreshManager.js';

/** An event as the feed serves it, with its headline price attached. */
export interface FeedEntry {
  event: SportEvent;
  markets: Market[];
  marketCount: number;
  leagueShortName: string;
  leagueId: string;
}

export interface LeagueGroup {
  category: SportCategory;
  leagues: Array<League & { seasonLabel: string }>;
}

export interface FeedSections {
  live: FeedEntry[];
  /** The single most compelling event, for the hero. */
  headline: FeedEntry | null;
  /** Starting within the next few hours. */
  next: FeedEntry[];
  byLeague: Array<{ league: League; events: FeedEntry[] }>;
  /** Competitions carrying content, for the filter rail. */
  leagues: Array<{ id: string; shortName: string; categoryId: string; count: number }>;
  totalEvents: number;
}

/** How many competitions the feed pulls in one pass. Bounded for rate limits. */
const FEED_LEAGUE_LIMIT = 8;

export class SportsApi {
  constructor(
    private readonly provider: SportsDataProvider,
    private readonly refresh: RefreshManager,
  ) {}

  private async rawLeagues(): Promise<{ leagues: League[]; freshness: Freshness }> {
    const result = await this.refresh.load<League[]>('catalog', 'catalog', 'catalog', () =>
      this.provider.getLeagues(),
    );
    return { leagues: result.data ?? [], freshness: result.freshness };
  }

  /** The competitions the feed should pull, in editorial order. */
  private pickFeedLeagues(leagues: readonly League[]): League[] {
    const byId = new Map(leagues.map((league) => [league.id, league]));
    const chosen: League[] = [];

    for (const id of FEATURED_LEAGUE_IDS) {
      const league = byId.get(id);
      if (league && league.providerActive && !league.outrightsOnly) chosen.push(league);
    }
    for (const league of leagues) {
      if (chosen.length >= FEED_LEAGUE_LIMIT) break;
      if (!league.providerActive || league.outrightsOnly) continue;
      if (chosen.some((existing) => existing.id === league.id)) continue;
      chosen.push(league);
    }
    return chosen.slice(0, FEED_LEAGUE_LIMIT);
  }

  private async eventsFor(league: League): Promise<{ entries: FeedEntry[]; freshness: Freshness }> {
    const result = await this.refresh.load<EventWithMarkets[]>(
      `odds:${league.providerKey}`,
      'upcomingOdds',
      'upcomingOdds',
      () => this.provider.getEventsWithOdds({ leagueKey: league.providerKey }),
    );

    const entries = (result.data ?? []).map((entry) => ({
      event: entry.event,
      // Only the headline market travels with a feed card; the event page
      // carries the rest. Keeps the payload small on a phone.
      markets: headlineMarket(entry.markets),
      marketCount: entry.markets.length,
      leagueShortName: league.shortName,
      leagueId: league.id,
    }));

    return { entries, freshness: result.freshness };
  }

  /** Season state, derived from the events this competition actually returned. */
  private seasonFor(league: League, entries: readonly FeedEntry[]): League {
    const live = entries.filter((entry) => entry.event.status === 'LIVE' || entry.event.status === 'PAUSED').length;
    const upcoming = entries.filter((entry) => entry.event.status === 'UPCOMING').length;
    const soonest = entries
      .filter((entry) => entry.event.status === 'UPCOMING')
      .map((entry) => Date.parse(entry.event.startTime))
      .sort((a, b) => a - b)[0];

    return {
      ...league,
      liveEventCount: live,
      upcomingEventCount: upcoming,
      seasonState: deriveSeasonState({
        providerActive: league.providerActive,
        liveEventCount: live,
        upcomingEventCount: upcoming,
        hasOdds: entries.some((entry) => entry.markets.length > 0),
        daysToNextEvent: soonest === undefined ? null : Math.max(0, (soonest - Date.now()) / 86_400_000),
      }),
    };
  }

  async groups(): Promise<Envelope<LeagueGroup[]>> {
    const { leagues, freshness } = await this.rawLeagues();
    const byCategory = new Map<string, Array<League & { seasonLabel: string }>>();

    for (const league of leagues) {
      const list = byCategory.get(league.categoryId) ?? [];
      list.push({ ...league, seasonLabel: league.providerActive ? 'Available' : 'Offseason' });
      byCategory.set(league.categoryId, list);
    }

    const groups: LeagueGroup[] = [...byCategory.entries()]
      .map(([categoryId, list]) => ({
        category: categoryById(categoryId),
        leagues: list.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.category.priority - b.category.priority);

    return { data: groups, freshness };
  }

  /**
   * The home feed: everything on, across every competition worth pulling.
   *
   * Competitions are fetched in parallel; one failing narrows the page
   * rather than emptying it, and the weakest freshness of the set is what
   * the page reports.
   */
  async feed(): Promise<Envelope<FeedSections>> {
    const { leagues, freshness: catalogueFreshness } = await this.rawLeagues();
    if (leagues.length === 0) return { data: emptyFeed(), freshness: catalogueFreshness };

    const picked = this.pickFeedLeagues(leagues);
    const results = await Promise.all(picked.map(async (league) => this.eventsFor(league)));

    const freshnesses: Freshness[] = [catalogueFreshness];
    const perLeague: Array<{ league: League; events: FeedEntry[] }> = [];
    const all: FeedEntry[] = [];

    for (const [index, result] of results.entries()) {
      const league = picked[index];
      if (!league) continue;
      freshnesses.push(result.freshness);

      const open = result.entries.filter(
        (entry) => entry.event.status === 'UPCOMING' || entry.event.status === 'LIVE' || entry.event.status === 'PAUSED',
      );
      if (open.length === 0) continue;

      perLeague.push({ league: this.seasonFor(league, result.entries), events: open });
      all.push(...open);
    }

    all.sort((a, b) => Date.parse(a.event.startTime) - Date.parse(b.event.startTime));

    const live = all.filter((entry) => entry.event.status === 'LIVE' || entry.event.status === 'PAUSED');
    const upcoming = all.filter((entry) => entry.event.status === 'UPCOMING');

    // The hero leads with an event that can actually be backed: KOVR does
    // not offer in-play betting, so a live event as the hero would present
    // a card whose buttons are all disabled. Live events get their own rail.
    const bettable = upcoming.filter((entry) => entry.markets.some((market) => market.selections.length > 0));
    const headline =
      FEATURED_LEAGUE_IDS.map((id) => bettable.find((entry) => entry.leagueId === id)).find(
        (entry): entry is FeedEntry => entry !== undefined,
      ) ??
      bettable[0] ??
      upcoming[0] ??
      live[0] ??
      null;

    const withinSixHours = Date.now() + 6 * 60 * 60 * 1000;
    const next = upcoming
      .filter((entry) => entry !== headline && Date.parse(entry.event.startTime) <= withinSixHours)
      .slice(0, 8);

    perLeague.sort((a, b) => a.league.priority - b.league.priority);

    return {
      data: {
        live,
        headline,
        next,
        byLeague: perLeague,
        leagues: perLeague.map((entry) => ({
          id: entry.league.id,
          shortName: entry.league.shortName,
          categoryId: entry.league.categoryId,
          count: entry.events.length,
        })),
        totalEvents: all.length,
      },
      freshness: RefreshManager.weakest(freshnesses),
    };
  }

  async leagueEvents(
    leagueId: string,
  ): Promise<Envelope<{ league: League & { seasonLabel: string }; events: FeedEntry[] } | null>> {
    const { leagues, freshness: catalogueFreshness } = await this.rawLeagues();
    const league = leagues.find((candidate) => candidate.id === leagueId);
    if (!league) return { data: null, freshness: catalogueFreshness };

    const { entries, freshness } = await this.eventsFor(league);
    const open = entries.filter(
      (entry) => entry.event.status === 'UPCOMING' || entry.event.status === 'LIVE' || entry.event.status === 'PAUSED',
    );
    const resolved = this.seasonFor(league, entries);

    return {
      data: {
        league: { ...resolved, seasonLabel: seasonLabel(resolved) },
        events: open.sort((a, b) => Date.parse(a.event.startTime) - Date.parse(b.event.startTime)),
      },
      freshness: RefreshManager.weakest([catalogueFreshness, freshness]),
    };
  }

  /**
   * One event with every market priced for it. Resolved straight from the
   * id, which encodes the competition and the provider's event id — there
   * is no database to look it up in.
   */
  async event(eventId: string): Promise<Envelope<EventWithMarkets | null>> {
    const decoded = decodeEventId(eventId);
    if (!decoded) {
      return {
        data: null,
        freshness: buildFreshness('unavailable', null, 'upcomingOdds', 'That event reference is not valid.'),
      };
    }

    const result = await this.refresh.load<EventWithMarkets | null>(
      `event:${eventId}`,
      'upcomingOdds',
      'upcomingOdds',
      () => this.provider.getEvent(decoded.leagueKey, decoded.providerEventId),
    );
    return { data: result.data ?? null, freshness: result.freshness };
  }

  /**
   * Confirmed status and result for the given events.
   *
   * Returns an entry only for events the provider actually reported on. One
   * it is silent about is simply absent, which leaves the bets on it open
   * rather than guessing.
   */
  async settlementFacts(eventIds: readonly string[]): Promise<Envelope<Array<{ id: string } & SettlementFact>>> {
    const wanted = new Map<string, { leagueKey: string; providerEventId: string }>();
    for (const id of eventIds.slice(0, 100)) {
      const decoded = decodeEventId(id);
      if (decoded) wanted.set(id, decoded);
    }
    if (wanted.size === 0) {
      return { data: [], freshness: buildFreshness('live', new Date().toISOString(), 'liveScores') };
    }

    const leagueKeys = [...new Set([...wanted.values()].map((entry) => entry.leagueKey))].slice(0, 6);
    const freshnesses: Freshness[] = [];
    const facts = new Map<string, SettlementFact>();

    await Promise.all(
      leagueKeys.map(async (leagueKey) => {
        const [resultsRes, statusRes] = await Promise.all([
          this.refresh.load(`results:${leagueKey}`, 'results', 'liveScores', () =>
            this.provider.getResults(leagueKey, 3),
          ),
          this.refresh.load(`statuses:${leagueKey}`, 'scores', 'liveScores', () =>
            this.provider.getEventStatuses(leagueKey),
          ),
        ]);
        freshnesses.push(resultsRes.freshness, statusRes.freshness);

        for (const entry of statusRes.data ?? []) {
          facts.set(`${leagueKey}|${entry.providerEventId}`, { status: entry.status, result: null });
        }
        // A confirmed result outranks a status line, and is the only thing
        // that ever marks an event FINAL here.
        for (const entry of resultsRes.data ?? []) {
          facts.set(`${leagueKey}|${entry.providerEventId}`, { status: 'FINAL', result: entry.result });
        }
      }),
    );

    const out: Array<{ id: string } & SettlementFact> = [];
    for (const [id, decoded] of wanted) {
      const fact = facts.get(`${decoded.leagueKey}|${decoded.providerEventId}`);
      if (fact) out.push({ id, ...fact });
    }

    return { data: out, freshness: RefreshManager.weakest(freshnesses) };
  }
}

/* ───────────────────────────── helpers ─────────────────────────────── */

function headlineMarket(markets: readonly Market[]): Market[] {
  if (markets.length === 0) return [];
  const moneyline = markets.find((market) => market.kind === 'MONEYLINE');
  return [moneyline ?? (markets[0] as Market)];
}

function seasonLabel(league: League): string {
  if (league.liveEventCount > 0) return 'Live now';
  if (league.upcomingEventCount > 0) return `${league.upcomingEventCount} scheduled`;
  return hasCurrentContent(league.seasonState) ? 'Available' : 'Nothing scheduled';
}

function emptyFeed(): FeedSections {
  return { live: [], headline: null, next: [], byLeague: [], leagues: [], totalEvents: 0 };
}
