/**
 * Sports data: synchronising it in, and reading it back out with an honest
 * account of how old it is.
 *
 * Provider responses are normalised by the provider, persisted here, and
 * served from the database. The database is therefore the last-known good
 * state — which is what lets KOVR keep working, clearly labelled as cached,
 * when the provider is unreachable.
 */

import type {
  Envelope,
  EventWithMarkets,
  Freshness,
  League,
  SeasonState,
  SportCategory,
  SportEvent,
} from '../domain/types.js';
import { buildFreshness } from '../domain/status.js';
import { categoryById, deriveSeasonState, hasCurrentContent, FEATURED_LEAGUE_IDS } from '../domain/catalog.js';
import type { SportsDataProvider } from '../providers/SportsDataProvider.js';
import type { CatalogRepository } from '../store/repositories/catalogRepo.js';
import type { EventRepository } from '../store/repositories/eventRepo.js';
import type { RefreshManager } from './refreshManager.js';
import type { MediaService } from './mediaService.js';

export interface LeagueGroup {
  category: SportCategory;
  leagues: League[];
}

export interface SyncOutcome {
  leagueId: string;
  events: number;
  markets: number;
  source: Freshness['source'];
  error: string | null;
}

export class SportsService {
  constructor(
    private readonly provider: SportsDataProvider,
    private readonly refresh: RefreshManager,
    private readonly catalog: CatalogRepository,
    private readonly events: EventRepository,
    private readonly media: MediaService,
  ) {}

  /* ─────────────────────────────── sync ───────────────────────────── */

  /**
   * Pull the provider's competition catalogue and store it.
   *
   * Categories are created from whatever grouping the provider reports, so a
   * sport KOVR has never carried appears on its own. Nothing is filtered out
   * but non-sport groups.
   */
  async syncCatalog(options: { force?: boolean } = {}): Promise<Envelope<League[]>> {
    const result = await this.refresh.load<League[]>(
      'catalog:leagues',
      'catalog',
      'catalog',
      () => this.provider.getLeagues(),
      { forceRefresh: options.force === true },
    );

    if (result.data) {
      const at = new Date().toISOString();
      for (const league of result.data) {
        this.catalog.upsertCategory(categoryById(league.categoryId));
        this.catalog.upsertLeague(league, at);
      }
    }

    return { data: result.data ?? this.catalog.listLeagues(), freshness: result.freshness };
  }

  /**
   * Refresh one competition's fixtures and prices, then recompute its season
   * state from what actually came back.
   */
  async syncLeague(leagueId: string, options: { force?: boolean } = {}): Promise<SyncOutcome> {
    const league = this.catalog.findLeague(leagueId);
    if (!league) {
      return { leagueId, events: 0, markets: 0, source: 'unavailable', error: 'Unknown league' };
    }

    const result = await this.refresh.load<EventWithMarkets[]>(
      `odds:${league.providerKey}`,
      'upcomingOdds',
      'upcomingOdds',
      () => this.provider.getEventsWithOdds({ leagueKey: league.providerKey }),
      { forceRefresh: options.force === true },
    );

    let marketCount = 0;
    if (result.data) {
      const observedAt = result.freshness.lastUpdatedAt ?? new Date().toISOString();
      for (const entry of result.data) {
        this.events.saveEvent(entry.event);
        if (entry.markets.length > 0) {
          this.events.saveMarkets(entry.event.id, entry.markets, observedAt);
          marketCount += entry.markets.length;
        }
      }
    }

    this.recomputeSeasonState(leagueId);

    return {
      leagueId,
      events: result.data?.length ?? 0,
      markets: marketCount,
      source: result.freshness.source,
      error: result.freshness.error,
    };
  }

  /** Update in-flight statuses for a competition from the provider's scores feed. */
  async syncStatuses(leagueId: string): Promise<{ updated: number; error: string | null }> {
    const league = this.catalog.findLeague(leagueId);
    if (!league) return { updated: 0, error: 'Unknown league' };

    const result = await this.refresh.load(
      `scores:${league.providerKey}`,
      'scores',
      'liveScores',
      () => this.provider.getEventStatuses(league.providerKey),
    );
    if (!result.data) return { updated: 0, error: result.freshness.error };

    const at = new Date().toISOString();
    // Index once: a scores response can carry dozens of events, and looking
    // each one up separately would rescan the table per entry.
    const byProviderId = new Map(
      this.events
        .findEvents({ leagueId, limit: 500 })
        .map((event) => [event.providerEventId, event.id] as const),
    );

    let updated = 0;
    for (const entry of result.data) {
      const eventId = byProviderId.get(entry.providerEventId);
      if (eventId === undefined) continue;
      this.events.updateStatus(eventId, entry.status, null, at);
      updated++;
    }
    this.recomputeSeasonState(leagueId);
    return { updated, error: null };
  }

  /**
   * Season state is recomputed from stored events rather than a calendar, so
   * a league leaving or entering season needs no code change and no deploy.
   */
  recomputeSeasonState(leagueId: string): SeasonState {
    const now = new Date().toISOString();
    const counts = this.events.countsForLeague(leagueId, now);
    const league = this.catalog.findLeague(leagueId);

    const daysToNext =
      counts.nextStart === null
        ? null
        : Math.max(0, (Date.parse(counts.nextStart) - Date.now()) / (24 * 60 * 60 * 1000));

    const state = deriveSeasonState({
      providerActive: league?.providerActive ?? true,
      liveEventCount: counts.live,
      upcomingEventCount: counts.upcoming,
      hasOdds: this.events.leagueHasOdds(leagueId),
      daysToNextEvent: daysToNext,
    });

    this.catalog.updateSeasonState(leagueId, state, counts.live, counts.upcoming, now);
    return state;
  }

  /* ─────────────────────────────── reads ──────────────────────────── */

  /** Leagues grouped by category, for the SPORTS navigation. */
  listLeagueGroups(options: { onlyWithContent?: boolean } = {}): LeagueGroup[] {
    const categories = this.catalog.listCategories();
    const leagues = this.catalog.listLeagues();

    return categories
      .map((category) => ({
        category,
        leagues: leagues
          .filter((league) => league.categoryId === category.id)
          .filter((league) => (options.onlyWithContent === true ? hasCurrentContent(league.seasonState) : true))
          .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name)),
      }))
      .filter((group) => group.leagues.length > 0);
  }

  listLeagues(): League[] {
    return this.catalog.listLeagues();
  }

  findLeague(leagueId: string): League | null {
    return this.catalog.findLeague(leagueId);
  }

  /** Freshness for stored sports data, derived from the newest row we hold. */
  private storedFreshness(lastUpdatedAt: string | null, className: Parameters<typeof buildFreshness>[2]): Freshness {
    if (lastUpdatedAt === null) {
      return buildFreshness('unavailable', null, className, 'No sports data has been loaded yet.');
    }
    return buildFreshness('cache', lastUpdatedAt, className);
  }

  getLeagueEvents(leagueId: string, limit = 60): Envelope<SportEvent[]> {
    const events = this.media.decorateEvents(
      this.events.findEvents({
        leagueId,
        statuses: ['UPCOMING', 'LIVE', 'PAUSED'],
        limit,
      }),
    );
    const newest = events.reduce<string | null>(
      (latest, event) => (latest === null || event.lastUpdatedAt > latest ? event.lastUpdatedAt : latest),
      null,
    );
    return { data: events, freshness: this.storedFreshness(newest, 'upcomingOdds') };
  }

  getEvent(eventId: string): Envelope<EventWithMarkets | null> {
    const stored = this.events.findEventWithMarkets(eventId);
    if (!stored) {
      return {
        data: null,
        freshness: buildFreshness('unavailable', null, 'upcomingOdds', 'KOVR holds no record of that event.'),
      };
    }
    return {
      data: { event: this.media.decorateEvent(stored.event), markets: stored.markets },
      freshness: this.storedFreshness(stored.event.lastUpdatedAt, 'upcomingOdds'),
    };
  }

  /**
   * The home feed.
   *
   * Sections appear only when they hold something. KOVR does not pad the page
   * with an empty "Live now" rail to keep the layout tidy.
   */
  getHomeFeed(): Envelope<{
    live: SportEvent[];
    featured: SportEvent[];
    startingSoon: SportEvent[];
    byLeague: Array<{ league: League; events: SportEvent[] }>;
  }> {
    const now = new Date();
    const nowIso = now.toISOString();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const live = this.events.findEvents({ statuses: ['LIVE', 'PAUSED'], limit: 20 });
    const startingSoon = this.events.findEvents({
      statuses: ['UPCOMING'],
      startingAfter: nowIso,
      startingBefore: in24h,
      limit: 20,
    });

    const featured: SportEvent[] = [];
    for (const leagueId of FEATURED_LEAGUE_IDS) {
      const league = this.catalog.findLeague(leagueId);
      if (!league || !hasCurrentContent(league.seasonState)) continue;
      featured.push(
        ...this.events.findEvents({ leagueId, statuses: ['UPCOMING', 'LIVE'], startingAfter: nowIso, limit: 4 }),
      );
    }

    const byLeague: Array<{ league: League; events: SportEvent[] }> = [];
    for (const league of this.catalog.listLeagues()) {
      if (!hasCurrentContent(league.seasonState)) continue;
      const events = this.events.findEvents({
        leagueId: league.id,
        statuses: ['UPCOMING', 'LIVE'],
        startingAfter: nowIso,
        limit: 6,
      });
      if (events.length > 0) byLeague.push({ league, events });
    }
    byLeague.sort((a, b) => a.league.priority - b.league.priority);

    return {
      data: {
        live: this.media.decorateEvents(live),
        featured: this.media.decorateEvents(featured),
        startingSoon: this.media.decorateEvents(startingSoon),
        byLeague: byLeague.map((entry) => ({
          league: entry.league,
          events: this.media.decorateEvents(entry.events),
        })),
      },
      freshness: this.storedFreshness(this.events.mostRecentFetchAt(), 'upcomingOdds'),
    };
  }

  /** Competitions worth refreshing on a schedule: those with current content. */
  refreshableLeagueIds(): string[] {
    return this.catalog
      .listLeagues()
      .filter((league) => hasCurrentContent(league.seasonState) || FEATURED_LEAGUE_IDS.includes(league.id))
      .sort((a, b) => a.priority - b.priority)
      .map((league) => league.id);
  }
}
