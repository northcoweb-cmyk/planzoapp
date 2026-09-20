/**
 * Persistence for events, competitors, markets and prices.
 *
 * Writing a price here updates the *current* market and appends to the
 * immutable `odds_snapshots` history when it has moved. Placed bets are in a
 * different table entirely and are never touched by a refresh — that
 * separation is what makes a bet's price permanent.
 */

import type { Database } from '../db.js';
import type {
  EventResult,
  EventStatus,
  EventWithMarkets,
  Market,
  MarketKind,
  Participant,
  ParticipantRole,
  SportEvent,
} from '../../domain/types.js';
import { describeMarket } from '../../domain/markets.js';
import { boolOrNull, enumOf, num, numOrNull, str, strOrNull, toSqlBool } from '../rows.js';
import type { Row } from '../db.js';

const EVENT_STATUSES: readonly EventStatus[] = [
  'UPCOMING',
  'LIVE',
  'PAUSED',
  'FINAL',
  'CANCELLED',
  'POSTPONED',
  'UNKNOWN',
];
const ROLES: readonly ParticipantRole[] = ['HOME', 'AWAY', 'NEUTRAL'];

type CardSegment = NonNullable<SportEvent['fight']>['cardSegment'];
const CARD_SEGMENTS = ['MAIN', 'PRELIM', 'EARLY_PRELIM'] as const;

/** The column is CHECK-constrained, but a stored value is still validated. */
function toCardSegment(value: string | null): CardSegment {
  return value !== null && (CARD_SEGMENTS as readonly string[]).includes(value)
    ? (value as CardSegment)
    : null;
}

export interface EventFilter {
  leagueId?: string;
  categoryId?: string;
  statuses?: readonly EventStatus[];
  /** Only events starting at or after this ISO timestamp. */
  startingAfter?: string;
  startingBefore?: string;
  limit?: number;
}

export class EventRepository {
  constructor(private readonly database: Database) {}

  /* ─────────────────────────────── writes ─────────────────────────── */

  /**
   * Insert or refresh one event and its competitors.
   *
   * Status and result columns are only ever advanced by explicit calls to
   * `updateStatus` / `recordResult`, so a schedule refresh that reports
   * UNKNOWN cannot roll a confirmed FINAL back to unknown.
   */
  saveEvent(event: SportEvent): void {
    this.database.transaction(() => {
      const existing = this.database.get('SELECT status FROM events WHERE id = ?', event.id);
      const nextStatus = existing ? EventRepository.reconcileStatus(enumOf(existing, 'status', EVENT_STATUSES), event.status) : event.status;

      this.database.run(
        `INSERT INTO events
           (id, provider_event_id, league_id, category_id, provider_league_key, name,
            event_title, start_time, status, period_label, venue, image_url,
            fight_weight_class, fight_is_main_event, fight_card_segment,
            fight_scheduled_rounds, fight_method, fight_end_round, fight_end_time,
            last_updated_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           league_id           = excluded.league_id,
           category_id         = excluded.category_id,
           provider_league_key = excluded.provider_league_key,
           name                = excluded.name,
           event_title         = COALESCE(excluded.event_title, events.event_title),
           start_time          = excluded.start_time,
           status              = excluded.status,
           period_label        = excluded.period_label,
           venue               = COALESCE(excluded.venue, events.venue),
           image_url           = COALESCE(excluded.image_url, events.image_url),
           last_updated_at     = excluded.last_updated_at`,
        event.id,
        event.providerEventId,
        event.leagueId,
        event.categoryId,
        event.providerLeagueKey,
        event.name,
        event.eventTitle,
        event.startTime,
        nextStatus,
        event.periodLabel,
        event.venue,
        event.imageUrl,
        event.fight?.weightClass ?? null,
        event.fight ? toSqlBool(event.fight.isMainEvent) : null,
        event.fight?.cardSegment ?? null,
        event.fight?.scheduledRounds ?? null,
        event.fight?.method ?? null,
        event.fight?.endRound ?? null,
        event.fight?.endTime ?? null,
        event.lastUpdatedAt,
        event.lastUpdatedAt,
      );

      for (const [index, participant] of event.participants.entries()) {
        this.database.run(
          `INSERT INTO participants (event_id, external_id, name, abbreviation, role, score, position)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(event_id, external_id) DO UPDATE SET
             name         = excluded.name,
             abbreviation = COALESCE(excluded.abbreviation, participants.abbreviation),
             role         = excluded.role,
             score        = COALESCE(excluded.score, participants.score),
             position     = excluded.position`,
          event.id,
          participant.externalId,
          participant.name,
          participant.abbreviation,
          participant.role,
          participant.score,
          index,
        );
      }
    });
  }

  /**
   * A refresh may advance an event's status but may not un-confirm one.
   *
   * Once the provider has told KOVR an event is FINAL or CANCELLED, a later
   * schedule-only response reporting UNKNOWN is less informed, not more.
   */
  static reconcileStatus(current: EventStatus, incoming: EventStatus): EventStatus {
    if (current === 'FINAL' || current === 'CANCELLED') return current;
    if (incoming === 'UNKNOWN' && current !== 'UNKNOWN') return current;
    return incoming;
  }

  updateStatus(eventId: string, status: EventStatus, periodLabel: string | null, at: string): void {
    const existing = this.database.get('SELECT status FROM events WHERE id = ?', eventId);
    if (!existing) return;
    const next = EventRepository.reconcileStatus(enumOf(existing, 'status', EVENT_STATUSES), status);
    this.database.run(
      'UPDATE events SET status = ?, period_label = ?, last_updated_at = ? WHERE id = ?',
      next,
      periodLabel,
      at,
      eventId,
    );
  }

  /**
   * Record a confirmed final result.
   *
   * Refuses to overwrite a result already on file: a settled event's grading
   * basis must stay exactly what it was at the time of settlement.
   */
  recordResult(eventId: string, result: EventResult, at: string): boolean {
    const existing = this.database.get('SELECT result_confirmed_at FROM events WHERE id = ?', eventId);
    if (!existing) return false;
    if (strOrNull(existing, 'result_confirmed_at') !== null) return false;

    this.database.transaction(() => {
      this.database.run(
        `UPDATE events
            SET status = 'FINAL',
                result_winner_external_id = ?,
                result_is_draw = ?,
                result_confirmed_at = ?,
                result_method = ?,
                result_scores_json = ?,
                last_updated_at = ?
          WHERE id = ?`,
        result.winnerExternalId,
        toSqlBool(result.isDraw),
        result.confirmedAt,
        result.method,
        JSON.stringify(result.scores),
        at,
        eventId,
      );
      for (const score of result.scores) {
        this.database.run(
          'UPDATE participants SET score = ? WHERE event_id = ? AND external_id = ?',
          score.score,
          eventId,
          score.externalId,
        );
      }
    });
    return true;
  }

  /**
   * Replace the priced markets for an event.
   *
   * Prices that moved are appended to `odds_snapshots` before the current row
   * is updated, so every observed move stays auditable.
   */
  saveMarkets(eventId: string, markets: readonly Market[], observedAt: string): void {
    this.database.transaction(() => {
      for (const market of markets) {
        const definition = describeMarket(market.key);
        this.database.run(
          `INSERT INTO markets (event_id, key, name, kind, priority, last_updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(event_id, key) DO UPDATE SET
             name = excluded.name, kind = excluded.kind,
             priority = excluded.priority, last_updated_at = excluded.last_updated_at`,
          eventId,
          market.key,
          market.name,
          market.kind,
          definition.priority,
          market.lastUpdatedAt,
        );

        const marketRow = this.database.get(
          'SELECT id FROM markets WHERE event_id = ? AND key = ?',
          eventId,
          market.key,
        );
        if (!marketRow) continue;
        const marketId = num(marketRow, 'id');

        for (const selection of market.selections) {
          const previous = this.database.get(
            'SELECT price_american FROM odds WHERE market_id = ? AND selection_id = ?',
            marketId,
            selection.id,
          );
          const previousPrice = previous ? num(previous, 'price_american') : null;

          if (previousPrice !== selection.price) {
            this.database.run(
              `INSERT INTO odds_snapshots
                 (event_id, market_key, selection_id, price_american, bookmaker_key, observed_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
              eventId,
              market.key,
              selection.id,
              selection.price,
              selection.bookmakerKey,
              observedAt,
            );
          }

          this.database.run(
            `INSERT INTO odds
               (market_id, event_id, selection_id, selection_name, participant_external_id,
                line, price_american, bookmaker_key, bookmaker_name, price_updated_at, fetched_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(market_id, selection_id) DO UPDATE SET
               selection_name          = excluded.selection_name,
               participant_external_id = excluded.participant_external_id,
               line                    = excluded.line,
               price_american          = excluded.price_american,
               bookmaker_key           = excluded.bookmaker_key,
               bookmaker_name          = excluded.bookmaker_name,
               price_updated_at        = excluded.price_updated_at,
               fetched_at              = excluded.fetched_at`,
            marketId,
            eventId,
            selection.id,
            selection.name,
            selection.participantExternalId,
            selection.line,
            selection.price,
            selection.bookmakerKey,
            selection.bookmakerName,
            selection.priceUpdatedAt,
            observedAt,
          );
        }

        // Selections the provider has withdrawn stop being offered.
        const keep = market.selections.map((s) => s.id);
        const placeholders = keep.map(() => '?').join(', ');
        this.database.run(
          keep.length > 0
            ? `DELETE FROM odds WHERE market_id = ? AND selection_id NOT IN (${placeholders})`
            : 'DELETE FROM odds WHERE market_id = ?',
          marketId,
          ...keep,
        );
      }
    });
  }

  /* ─────────────────────────────── reads ──────────────────────────── */

  private toEvent(row: Row): SportEvent {
    const id = str(row, 'id');
    const confirmedAt = strOrNull(row, 'result_confirmed_at');
    const scoresJson = strOrNull(row, 'result_scores_json');
    const categoryId = str(row, 'category_id');

    let result: EventResult | null = null;
    if (confirmedAt !== null) {
      let scores: Array<{ externalId: string; score: number }> = [];
      if (scoresJson) {
        try {
          const parsed: unknown = JSON.parse(scoresJson);
          if (Array.isArray(parsed)) scores = parsed as Array<{ externalId: string; score: number }>;
        } catch {
          scores = [];
        }
      }
      result = {
        winnerExternalId: strOrNull(row, 'result_winner_external_id'),
        isDraw: boolOrNull(row, 'result_is_draw') === true,
        scores,
        confirmedAt,
        method: strOrNull(row, 'result_method'),
      };
    }

    return {
      id,
      providerEventId: str(row, 'provider_event_id'),
      leagueId: str(row, 'league_id'),
      categoryId,
      providerLeagueKey: str(row, 'provider_league_key'),
      name: str(row, 'name'),
      eventTitle: strOrNull(row, 'event_title'),
      participants: this.listParticipants(id),
      startTime: str(row, 'start_time'),
      status: enumOf(row, 'status', EVENT_STATUSES),
      periodLabel: strOrNull(row, 'period_label'),
      venue: strOrNull(row, 'venue'),
      result,
      fight:
        categoryId === 'combat'
          ? {
              weightClass: strOrNull(row, 'fight_weight_class'),
              isMainEvent: boolOrNull(row, 'fight_is_main_event') === true,
              cardSegment: toCardSegment(strOrNull(row, 'fight_card_segment')),
              scheduledRounds: numOrNull(row, 'fight_scheduled_rounds'),
              method: strOrNull(row, 'fight_method'),
              endRound: numOrNull(row, 'fight_end_round'),
              endTime: strOrNull(row, 'fight_end_time'),
            }
          : null,
      imageUrl: strOrNull(row, 'image_url'),
      lastUpdatedAt: str(row, 'last_updated_at'),
    };
  }

  listParticipants(eventId: string): Participant[] {
    return this.database
      .all(
        `SELECT external_id, name, abbreviation, role, score
           FROM participants WHERE event_id = ? ORDER BY position, id`,
        eventId,
      )
      .map((row) => ({
        externalId: str(row, 'external_id'),
        name: str(row, 'name'),
        abbreviation: strOrNull(row, 'abbreviation'),
        role: enumOf(row, 'role', ROLES),
        imageUrl: null,
        score: numOrNull(row, 'score'),
      }));
  }

  findEvent(eventId: string): SportEvent | null {
    const row = this.database.get('SELECT * FROM events WHERE id = ?', eventId);
    return row ? this.toEvent(row) : null;
  }

  findEvents(filter: EventFilter = {}): SportEvent[] {
    const where: string[] = [];
    const params: Array<string | number> = [];

    if (filter.leagueId) {
      where.push('league_id = ?');
      params.push(filter.leagueId);
    }
    if (filter.categoryId) {
      where.push('category_id = ?');
      params.push(filter.categoryId);
    }
    if (filter.statuses && filter.statuses.length > 0) {
      where.push(`status IN (${filter.statuses.map(() => '?').join(', ')})`);
      params.push(...filter.statuses);
    }
    if (filter.startingAfter) {
      where.push('start_time >= ?');
      params.push(filter.startingAfter);
    }
    if (filter.startingBefore) {
      where.push('start_time <= ?');
      params.push(filter.startingBefore);
    }

    const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const limit = Math.min(500, Math.max(1, filter.limit ?? 200));
    return this.database
      .all(`SELECT * FROM events ${clause} ORDER BY start_time ASC LIMIT ?`, ...params, limit)
      .map((row) => this.toEvent(row));
  }

  listMarkets(eventId: string): Market[] {
    const markets = this.database.all(
      'SELECT id, key, name, kind, last_updated_at FROM markets WHERE event_id = ? ORDER BY priority, key',
      eventId,
    );

    return markets.map((marketRow) => {
      const marketId = num(marketRow, 'id');
      const selections = this.database
        .all(
          `SELECT selection_id, selection_name, participant_external_id, line, price_american,
                  bookmaker_key, bookmaker_name, price_updated_at
             FROM odds WHERE market_id = ? ORDER BY id`,
          marketId,
        )
        .map((row) => ({
          id: str(row, 'selection_id'),
          name: str(row, 'selection_name'),
          participantExternalId: strOrNull(row, 'participant_external_id'),
          line: numOrNull(row, 'line'),
          price: num(row, 'price_american'),
          bookmakerKey: str(row, 'bookmaker_key'),
          bookmakerName: str(row, 'bookmaker_name'),
          priceUpdatedAt: str(row, 'price_updated_at'),
        }));

      return {
        key: str(marketRow, 'key'),
        name: str(marketRow, 'name'),
        kind: str(marketRow, 'kind') as MarketKind,
        selections,
        lastUpdatedAt: str(marketRow, 'last_updated_at'),
      };
    });
  }

  findEventWithMarkets(eventId: string): EventWithMarkets | null {
    const event = this.findEvent(eventId);
    if (!event) return null;
    return { event, markets: this.listMarkets(eventId) };
  }

  /** The current price for one selection, or null when it is no longer offered. */
  findCurrentPrice(
    eventId: string,
    marketKey: string,
    selectionId: string,
  ): { price: number; line: number | null; bookmakerKey: string; updatedAt: string } | null {
    const row = this.database.get(
      `SELECT o.price_american, o.line, o.bookmaker_key, o.price_updated_at
         FROM odds o JOIN markets m ON m.id = o.market_id
        WHERE o.event_id = ? AND m.key = ? AND o.selection_id = ?`,
      eventId,
      marketKey,
      selectionId,
    );
    if (!row) return null;
    return {
      price: num(row, 'price_american'),
      line: numOrNull(row, 'line'),
      bookmakerKey: str(row, 'bookmaker_key'),
      updatedAt: str(row, 'price_updated_at'),
    };
  }

  countsForLeague(leagueId: string, now: string): { live: number; upcoming: number; nextStart: string | null } {
    const live = this.database.get(
      "SELECT COUNT(*) AS n FROM events WHERE league_id = ? AND status = 'LIVE'",
      leagueId,
    );
    const upcoming = this.database.get(
      "SELECT COUNT(*) AS n, MIN(start_time) AS next FROM events WHERE league_id = ? AND status = 'UPCOMING' AND start_time >= ?",
      leagueId,
      now,
    );
    return {
      live: live ? num(live, 'n') : 0,
      upcoming: upcoming ? num(upcoming, 'n') : 0,
      nextStart: upcoming ? strOrNull(upcoming, 'next') : null,
    };
  }

  /** Whether any upcoming event in this league currently carries a price. */
  leagueHasOdds(leagueId: string): boolean {
    const row = this.database.get(
      `SELECT COUNT(*) AS n FROM odds o JOIN events e ON e.id = o.event_id
        WHERE e.league_id = ? AND e.status = 'UPCOMING'`,
      leagueId,
    );
    return row !== null && num(row, 'n') > 0;
  }

  mostRecentFetchAt(): string | null {
    const row = this.database.get('SELECT MAX(last_updated_at) AS at FROM events');
    return row ? strOrNull(row, 'at') : null;
  }

  /** Events needing a result check: started, not yet confirmed final. */
  findAwaitingResult(now: string): SportEvent[] {
    return this.database
      .all(
        `SELECT * FROM events
          WHERE result_confirmed_at IS NULL
            AND start_time <= ?
            AND status IN ('UPCOMING','LIVE','PAUSED','UNKNOWN','FINAL')
          ORDER BY start_time DESC LIMIT 200`,
        now,
      )
      .map((row) => this.toEvent(row));
  }

  countSnapshots(): number {
    const row = this.database.get('SELECT COUNT(*) AS n FROM odds_snapshots');
    return row ? num(row, 'n') : 0;
  }
}
