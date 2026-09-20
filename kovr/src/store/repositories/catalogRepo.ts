/** Persistence for the sport and league catalogue. */

import type { Database } from '../db.js';
import type { League, SeasonState, SportCategory } from '../../domain/types.js';
import { bool, enumOf, num, str, strOrNull, toSqlBool } from '../rows.js';

const SEASON_STATES: readonly SeasonState[] = [
  'LIVE',
  'ACTIVE',
  'UPCOMING',
  'OFFSEASON',
  'NO_CURRENT_EVENTS',
  'NO_ODDS_AVAILABLE',
  'UNKNOWN',
];

export class CatalogRepository {
  constructor(private readonly database: Database) {}

  upsertCategory(category: SportCategory): void {
    this.database.run(
      `INSERT INTO sport_categories (id, name, priority, icon) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, priority = excluded.priority, icon = excluded.icon`,
      category.id,
      category.name,
      category.priority,
      category.icon,
    );
  }

  listCategories(): SportCategory[] {
    return this.database
      .all('SELECT id, name, priority, icon FROM sport_categories ORDER BY priority, name')
      .map((row) => ({
        id: str(row, 'id'),
        name: str(row, 'name'),
        priority: num(row, 'priority'),
        icon: str(row, 'icon'),
      }));
  }

  /**
   * Insert or refresh a league. Event counts and season state are owned by
   * the sync service and are left alone here so a catalogue refresh cannot
   * wipe the counts a fixture refresh just wrote.
   */
  upsertLeague(league: League, syncedAt: string): void {
    this.database.run(
      `INSERT INTO leagues
         (id, provider_key, category_id, name, short_name, description, priority,
          provider_active, outrights_only, season_state, live_event_count,
          upcoming_event_count, last_synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         provider_key    = excluded.provider_key,
         category_id     = excluded.category_id,
         name            = excluded.name,
         short_name      = excluded.short_name,
         description     = excluded.description,
         priority        = excluded.priority,
         provider_active = excluded.provider_active,
         outrights_only  = excluded.outrights_only,
         last_synced_at  = excluded.last_synced_at`,
      league.id,
      league.providerKey,
      league.categoryId,
      league.name,
      league.shortName,
      league.description,
      league.priority,
      toSqlBool(league.providerActive),
      toSqlBool(league.outrightsOnly),
      league.seasonState,
      league.liveEventCount,
      league.upcomingEventCount,
      syncedAt,
    );
  }

  updateSeasonState(
    leagueId: string,
    state: SeasonState,
    liveCount: number,
    upcomingCount: number,
    syncedAt: string,
  ): void {
    this.database.run(
      `UPDATE leagues
          SET season_state = ?, live_event_count = ?, upcoming_event_count = ?, last_synced_at = ?
        WHERE id = ?`,
      state,
      liveCount,
      upcomingCount,
      syncedAt,
      leagueId,
    );
  }

  private static toLeague(row: Parameters<typeof str>[0]): League {
    return {
      id: str(row, 'id'),
      providerKey: str(row, 'provider_key'),
      categoryId: str(row, 'category_id'),
      name: str(row, 'name'),
      shortName: str(row, 'short_name'),
      description: str(row, 'description'),
      priority: num(row, 'priority'),
      providerActive: bool(row, 'provider_active'),
      outrightsOnly: bool(row, 'outrights_only'),
      seasonState: enumOf(row, 'season_state', SEASON_STATES),
      liveEventCount: num(row, 'live_event_count'),
      upcomingEventCount: num(row, 'upcoming_event_count'),
    };
  }

  listLeagues(): League[] {
    return this.database
      .all('SELECT * FROM leagues ORDER BY priority, name')
      .map(CatalogRepository.toLeague);
  }

  findLeague(leagueId: string): League | null {
    const row = this.database.get('SELECT * FROM leagues WHERE id = ?', leagueId);
    return row ? CatalogRepository.toLeague(row) : null;
  }

  findLeagueByProviderKey(providerKey: string): League | null {
    const row = this.database.get('SELECT * FROM leagues WHERE provider_key = ?', providerKey);
    return row ? CatalogRepository.toLeague(row) : null;
  }

  lastSyncedAt(): string | null {
    const row = this.database.get('SELECT MAX(last_synced_at) AS synced FROM leagues');
    return row ? strOrNull(row, 'synced') : null;
  }
}
