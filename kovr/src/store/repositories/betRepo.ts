/**
 * Bets, their legs, and settlement records.
 *
 * The price on a `bet_selections` row is written once, at placement, and is
 * never updated by anything in KOVR. Market refreshes write to `odds`; this
 * table is deliberately untouched by them.
 */

import type { Database } from '../db.js';
import { isUniqueViolation } from '../db.js';
import type { Bet, BetSelection, BetStatus } from '../../domain/types.js';
import type { Cents } from '../../core/money.js';
import type { AmericanOdds } from '../../core/odds.js';
import { newId } from '../../domain/identity.js';
import { bool, enumOf, num, numOrNull, str, strOrNull } from '../rows.js';
import type { Row } from '../db.js';

const BET_STATUSES: readonly BetStatus[] = ['OPEN', 'WON', 'LOST', 'PUSH', 'VOID', 'CANCELLED'];

export class DuplicateSettlementError extends Error {
  readonly code = 'ALREADY_SETTLED';
  constructor(public readonly betId: string) {
    super(`Bet ${betId} has already been settled`);
    this.name = 'DuplicateSettlementError';
  }
}

export interface NewBetSelection {
  eventId: string;
  providerEventId: string;
  leagueId: string;
  eventName: string;
  eventStartTime: string;
  marketKey: string;
  marketName: string;
  selectionId: string;
  selectionName: string;
  participantExternalId: string | null;
  line: number | null;
  priceAmerican: AmericanOdds;
  bookmakerKey: string;
  /** True when the market carried a Draw selection at placement. */
  marketOffersDraw: boolean;
}

export interface NewBet {
  userId: string;
  walletId: string;
  stakeCents: Cents;
  priceAmerican: AmericanOdds;
  potentialPayoutCents: Cents;
  selections: readonly NewBetSelection[];
}

export class BetRepository {
  constructor(private readonly database: Database) {}

  create(bet: NewBet, placedAt: string): Bet {
    if (bet.selections.length === 0) throw new Error('a bet needs at least one selection');

    const betId = newId('bet');
    this.database.transaction(() => {
      this.database.run(
        `INSERT INTO bets
           (id, user_id, wallet_id, stake_cents, price_american, potential_payout_cents,
            status, payout_cents, placed_at, settled_at)
         VALUES (?, ?, ?, ?, ?, ?, 'OPEN', NULL, ?, NULL)`,
        betId,
        bet.userId,
        bet.walletId,
        bet.stakeCents,
        bet.priceAmerican,
        bet.potentialPayoutCents,
        placedAt,
      );

      for (const selection of bet.selections) {
        this.database.run(
          `INSERT INTO bet_selections
             (id, bet_id, event_id, provider_event_id, league_id, event_name, event_start_time,
              market_key, market_name, selection_id, selection_name, participant_external_id,
              line, price_american, bookmaker_key, market_offers_draw, status, settled_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', NULL)`,
          newId('bsl'),
          betId,
          selection.eventId,
          selection.providerEventId,
          selection.leagueId,
          selection.eventName,
          selection.eventStartTime,
          selection.marketKey,
          selection.marketName,
          selection.selectionId,
          selection.selectionName,
          selection.participantExternalId,
          selection.line,
          selection.priceAmerican,
          selection.bookmakerKey,
          selection.marketOffersDraw ? 1 : 0,
        );
      }
    });

    const created = this.findById(betId);
    if (!created) throw new Error('bet creation failed');
    return created;
  }

  private static toSelection(row: Row): BetSelection {
    return {
      id: str(row, 'id'),
      betId: str(row, 'bet_id'),
      eventId: str(row, 'event_id'),
      providerEventId: str(row, 'provider_event_id'),
      leagueId: str(row, 'league_id'),
      eventName: str(row, 'event_name'),
      eventStartTime: str(row, 'event_start_time'),
      marketKey: str(row, 'market_key'),
      marketName: str(row, 'market_name'),
      selectionId: str(row, 'selection_id'),
      selectionName: str(row, 'selection_name'),
      participantExternalId: strOrNull(row, 'participant_external_id'),
      line: numOrNull(row, 'line'),
      priceAmerican: num(row, 'price_american'),
      bookmakerKey: str(row, 'bookmaker_key'),
      marketOffersDraw: bool(row, 'market_offers_draw'),
      status: enumOf(row, 'status', BET_STATUSES),
      settledAt: strOrNull(row, 'settled_at'),
    };
  }

  private toBet(row: Row): Bet {
    const id = str(row, 'id');
    return {
      id,
      userId: str(row, 'user_id'),
      walletId: str(row, 'wallet_id'),
      stakeCents: num(row, 'stake_cents'),
      priceAmerican: num(row, 'price_american'),
      potentialPayoutCents: num(row, 'potential_payout_cents'),
      status: enumOf(row, 'status', BET_STATUSES),
      placedAt: str(row, 'placed_at'),
      settledAt: strOrNull(row, 'settled_at'),
      payoutCents: numOrNull(row, 'payout_cents'),
      selections: this.listSelections(id),
    };
  }

  listSelections(betId: string): BetSelection[] {
    return this.database
      .all('SELECT * FROM bet_selections WHERE bet_id = ? ORDER BY rowid', betId)
      .map(BetRepository.toSelection);
  }

  findById(betId: string): Bet | null {
    const row = this.database.get('SELECT * FROM bets WHERE id = ?', betId);
    return row ? this.toBet(row) : null;
  }

  listByUser(userId: string, statuses?: readonly BetStatus[], limit = 100): Bet[] {
    const bounded = Math.min(500, Math.max(1, limit));
    if (statuses && statuses.length > 0) {
      const placeholders = statuses.map(() => '?').join(', ');
      return this.database
        .all(
          `SELECT * FROM bets WHERE user_id = ? AND status IN (${placeholders})
            ORDER BY placed_at DESC, rowid DESC LIMIT ?`,
          userId,
          ...statuses,
          bounded,
        )
        .map((row) => this.toBet(row));
    }
    return this.database
      .all('SELECT * FROM bets WHERE user_id = ? ORDER BY placed_at DESC, rowid DESC LIMIT ?', userId, bounded)
      .map((row) => this.toBet(row));
  }

  /** Open bets with at least one leg on this event — the settlement worklist. */
  findOpenBetsForEvent(eventId: string): Bet[] {
    return this.database
      .all(
        `SELECT DISTINCT b.* FROM bets b
           JOIN bet_selections s ON s.bet_id = b.id
          WHERE s.event_id = ? AND b.status = 'OPEN'
          ORDER BY b.placed_at ASC`,
        eventId,
      )
      .map((row) => this.toBet(row));
  }

  countOpenForEvent(eventId: string): number {
    const row = this.database.get(
      `SELECT COUNT(DISTINCT b.id) AS n FROM bets b JOIN bet_selections s ON s.bet_id = b.id
        WHERE s.event_id = ? AND b.status = 'OPEN'`,
      eventId,
    );
    return row ? num(row, 'n') : 0;
  }

  updateSelectionStatus(selectionRowId: string, status: BetStatus, at: string): void {
    this.database.run(
      'UPDATE bet_selections SET status = ?, settled_at = ? WHERE id = ?',
      status,
      status === 'OPEN' ? null : at,
      selectionRowId,
    );
  }

  /**
   * Write the settlement record and close the bet.
   *
   * `settlements.bet_id` is UNIQUE, so a second attempt raises
   * `DuplicateSettlementError` instead of grading — and, crucially, instead
   * of paying — a second time. The caller credits the wallet only after this
   * returns successfully.
   */
  settle(
    betId: string,
    outcome: Exclude<BetStatus, 'OPEN'>,
    payoutCents: Cents,
    eventId: string,
    resultSource: string,
    resultConfirmedAt: string,
    at: string,
  ): string {
    const settlementId = newId('stl');
    this.database.transaction(() => {
      try {
        this.database.run(
          `INSERT INTO settlements
             (id, bet_id, event_id, outcome, payout_cents, result_source, result_confirmed_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          settlementId,
          betId,
          eventId,
          outcome,
          payoutCents,
          resultSource,
          resultConfirmedAt,
          at,
        );
      } catch (error) {
        if (isUniqueViolation(error)) throw new DuplicateSettlementError(betId);
        throw error;
      }

      const changed = this.database.run(
        `UPDATE bets SET status = ?, payout_cents = ?, settled_at = ? WHERE id = ? AND status = 'OPEN'`,
        outcome,
        payoutCents,
        at,
        betId,
      );
      // A bet that is no longer OPEN was graded by someone else first.
      if (changed.changes === 0) throw new DuplicateSettlementError(betId);
    });
    return settlementId;
  }

  hasSettlement(betId: string): boolean {
    return this.database.get('SELECT 1 AS present FROM settlements WHERE bet_id = ?', betId) !== null;
  }

  countByStatus(userId: string): Record<BetStatus, number> {
    const counts: Record<BetStatus, number> = { OPEN: 0, WON: 0, LOST: 0, PUSH: 0, VOID: 0, CANCELLED: 0 };
    for (const row of this.database.all(
      'SELECT status, COUNT(*) AS n FROM bets WHERE user_id = ? GROUP BY status',
      userId,
    )) {
      counts[enumOf(row, 'status', BET_STATUSES)] = num(row, 'n');
    }
    return counts;
  }

  /** Developer-only: clear a demo account's betting history. */
  resetForUser(userId: string): void {
    this.database.transaction(() => {
      this.database.run(
        'DELETE FROM settlements WHERE bet_id IN (SELECT id FROM bets WHERE user_id = ?)',
        userId,
      );
      this.database.run('DELETE FROM bets WHERE user_id = ?', userId);
    });
  }
}
