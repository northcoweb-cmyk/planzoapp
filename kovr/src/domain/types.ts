/**
 * KOVR's internal data model.
 *
 * Nothing outside `src/providers/` may reference a provider's raw response
 * shape. Providers normalise into these types; the database, the services and
 * the UI speak only this language. Swapping data providers must not require
 * touching anything below this file.
 */

import type { AmericanOdds } from '../core/odds.js';
import type { Cents } from '../core/money.js';

/* ────────────────────────────── identity ────────────────────────────── */

/**
 * A stable identifier issued by the upstream provider. Names are never used
 * as identity in KOVR — two fighters can share a surname, two clubs a city.
 */
export type ExternalId = string;

/** KOVR's own slug for a sport category, e.g. `combat`, `football`. */
export type CategoryId = string;

/** KOVR's own slug for a league/competition, e.g. `ufc`, `nfl`, `epl`. */
export type LeagueId = string;

/* ────────────────────────────── catalogue ───────────────────────────── */

/**
 * A top-level grouping in the SPORTS navigation. Derived from the provider's
 * own grouping where it supplies one, so a newly supported sport appears
 * without a code change.
 */
export interface SportCategory {
  id: CategoryId;
  name: string;
  /** Lower sorts first. UFC and NFL are KOVR's primary surfaces. */
  priority: number;
  icon: string;
}

/** Where a league sits in its calendar right now. */
export type SeasonState =
  | 'LIVE'
  | 'ACTIVE'
  | 'UPCOMING'
  | 'OFFSEASON'
  | 'NO_CURRENT_EVENTS'
  | 'NO_ODDS_AVAILABLE'
  | 'UNKNOWN';

/**
 * A competition KOVR can show: NFL, UFC, the Premier League, the ATP tour.
 * Discovered from the provider catalogue rather than hard-coded, so a league
 * that comes into season appears on its own.
 */
export interface League {
  id: LeagueId;
  /** The provider's key for this competition. Opaque outside the provider. */
  providerKey: string;
  categoryId: CategoryId;
  name: string;
  shortName: string;
  /** Provider's human description, kept for tooltips and search. */
  description: string;
  /** Lower sorts first; KOVR's editorial ordering within a category. */
  priority: number;
  /** True when the provider reports the competition as currently offered. */
  providerActive: boolean;
  /** Futures/outright markets only — no head-to-head fixtures. */
  outrightsOnly: boolean;
  seasonState: SeasonState;
  /** Counts that drive the season state and the navigation badges. */
  liveEventCount: number;
  upcomingEventCount: number;
}

/* ─────────────────────────────── events ─────────────────────────────── */

export type EventStatus =
  | 'UPCOMING'
  | 'LIVE'
  | 'PAUSED'
  | 'FINAL'
  | 'CANCELLED'
  | 'POSTPONED'
  | 'UNKNOWN';

/** Which side of a fixture a participant occupies. */
export type ParticipantRole = 'HOME' | 'AWAY' | 'NEUTRAL';

/**
 * A team, fighter, player or competitor. `externalId` is the provider's own
 * identifier where it publishes one; when it does not, KOVR derives a stable
 * deterministic id from the league and the canonical name so that the same
 * competitor resolves to the same row on every refresh.
 */
export interface Participant {
  externalId: ExternalId;
  name: string;
  /** e.g. "BAL" — only when the provider or a verified mapping supplies it. */
  abbreviation: string | null;
  role: ParticipantRole;
  /** Resolved through the media layer by id; null when nothing is verified. */
  imageUrl: string | null;
  /** Live score for this side, when the provider reports one. */
  score: number | null;
}

/** Combat-sports detail. Present only when the provider supplies it. */
export interface FightDetail {
  weightClass: string | null;
  isMainEvent: boolean;
  /** `MAIN`, `PRELIM`, `EARLY_PRELIM` — null when unknown. */
  cardSegment: 'MAIN' | 'PRELIM' | 'EARLY_PRELIM' | null;
  scheduledRounds: number | null;
  /** Result detail, only once the bout is confirmed final. */
  method: string | null;
  endRound: number | null;
  endTime: string | null;
}

/**
 * A single bettable event, normalised. Every field is either supplied by the
 * provider or explicitly null — KOVR never fills a gap with an invention.
 */
export interface SportEvent {
  /** KOVR's internal id: stable, namespaced, derived from the provider id. */
  id: string;
  providerEventId: ExternalId;
  leagueId: LeagueId;
  categoryId: CategoryId;
  /** Provider's league key, retained for refresh calls. */
  providerLeagueKey: string;
  /** "Fighter A vs Fighter B" or "Ravens @ Chiefs". */
  name: string;
  /** Named event or card, e.g. "UFC 312". Null when the provider has none. */
  eventTitle: string | null;
  participants: Participant[];
  startTime: string;
  status: EventStatus;
  /** Period, quarter, inning, set or round descriptor while live. */
  periodLabel: string | null;
  venue: string | null;
  /** Populated only once the provider confirms the event is complete. */
  result: EventResult | null;
  fight: FightDetail | null;
  /** Artwork for the event, resolved by id through the media layer. */
  imageUrl: string | null;
  lastUpdatedAt: string;
}

/**
 * A confirmed final result. KOVR only ever constructs one of these from a
 * provider response that explicitly reports the event as complete — never
 * from the clock running past the scheduled start.
 */
export interface EventResult {
  /** `externalId` of the winning participant; null for a draw. */
  winnerExternalId: ExternalId | null;
  isDraw: boolean;
  scores: Array<{ externalId: ExternalId; score: number }>;
  /** Provider timestamp for the completion, used for settlement audit. */
  confirmedAt: string;
  /** How the provider described the finish, when it does. */
  method: string | null;
}

/* ─────────────────────────────── markets ────────────────────────────── */

/**
 * Coarse classification, used only for grouping and display. Unrecognised
 * provider markets normalise to `OTHER` and still render — KOVR shows what
 * the provider offers rather than an allow-list.
 */
export type MarketKind =
  | 'MONEYLINE'
  | 'SPREAD'
  | 'TOTAL'
  | 'OUTRIGHT'
  | 'PLAYER_PROP'
  | 'TEAM_PROP'
  | 'PERIOD'
  | 'OTHER';

export interface MarketSelection {
  /** Stable within its market: provider outcome name plus any line. */
  id: string;
  name: string;
  /** Links the selection to a competitor for settlement. Null for totals. */
  participantExternalId: ExternalId | null;
  /** Handicap or total line, e.g. -3.5 or 47.5. Null when the market has none. */
  line: number | null;
  price: AmericanOdds;
  /** Bookmaker the price came from. Never blank, never fabricated. */
  bookmakerKey: string;
  bookmakerName: string;
  /** Provider's own timestamp for this price. */
  priceUpdatedAt: string;
}

export interface Market {
  /** Provider market key, e.g. `h2h`, `spreads`, `player_pass_tds`. */
  key: string;
  name: string;
  kind: MarketKind;
  selections: MarketSelection[];
  lastUpdatedAt: string;
}

/** An event together with the markets currently priced for it. */
export interface EventWithMarkets {
  event: SportEvent;
  markets: Market[];
}

/* ───────────────────────────── freshness ────────────────────────────── */

/** Where a payload came from. `unavailable` never carries invented data. */
export type DataSource = 'live' | 'cache' | 'unavailable';

/**
 * Attached to every sports payload KOVR serves. The UI uses it to label
 * stale data honestly instead of presenting it as live.
 */
export interface Freshness {
  source: DataSource;
  /** ISO timestamp of the last successful provider fetch, if any. */
  lastUpdatedAt: string | null;
  ageMs: number | null;
  stale: boolean;
  /** Present when the last provider attempt failed. */
  error: string | null;
}

export interface Envelope<T> {
  data: T;
  freshness: Freshness;
}

/* ─────────────────────────── wallet and bets ────────────────────────── */

export type TransactionType =
  | 'DEMO_INITIAL_BALANCE'
  | 'DEMO_DEPOSIT'
  | 'BET_PLACED'
  | 'BET_PAYOUT'
  | 'BET_REFUND'
  | 'DEMO_WITHDRAWAL';

export interface WalletTransaction {
  id: string;
  walletId: string;
  type: TransactionType;
  /** Signed: credits positive, debits negative. Always integer cents. */
  amountCents: Cents;
  /** Wallet balance immediately after this row was written. */
  balanceAfterCents: Cents;
  description: string;
  betId: string | null;
  createdAt: string;
}

export interface Wallet {
  id: string;
  userId: string;
  balanceCents: Cents;
  currency: 'USD';
  updatedAt: string;
}

export type BetStatus = 'OPEN' | 'WON' | 'LOST' | 'PUSH' | 'VOID' | 'CANCELLED';

/**
 * One leg of a bet. The price stored here is the price at placement and is
 * never rewritten — a later market move must not alter a placed bet.
 */
export interface BetSelection {
  id: string;
  betId: string;
  eventId: string;
  providerEventId: ExternalId;
  leagueId: LeagueId;
  eventName: string;
  eventStartTime: string;
  marketKey: string;
  marketName: string;
  selectionId: string;
  selectionName: string;
  participantExternalId: ExternalId | null;
  line: number | null;
  /** Immutable: the price the bettor accepted. */
  priceAmerican: AmericanOdds;
  bookmakerKey: string;
  /**
   * Whether the market offered a Draw when this bet was struck. Recorded at
   * placement so a drawn result grades the same way years later.
   */
  marketOffersDraw: boolean;
  status: BetStatus;
  settledAt: string | null;
}

export interface Bet {
  id: string;
  userId: string;
  walletId: string;
  stakeCents: Cents;
  /** Combined price across all legs, frozen at placement. */
  priceAmerican: AmericanOdds;
  potentialPayoutCents: Cents;
  status: BetStatus;
  placedAt: string;
  settledAt: string | null;
  /** Credited on settlement: payout for a win, stake for a push or void. */
  payoutCents: Cents | null;
  selections: BetSelection[];
}

export interface ActivityItem {
  id: string;
  kind: 'BET' | 'DEPOSIT' | 'WITHDRAWAL' | 'PAYOUT' | 'REFUND' | 'SYSTEM';
  title: string;
  detail: string;
  amountCents: Cents | null;
  status: string;
  createdAt: string;
}
