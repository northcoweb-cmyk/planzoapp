/**
 * Translate The Odds API wire format into KOVR's domain model.
 *
 * Two rules govern everything here:
 *   1. A field the provider did not supply becomes `null`, never a guess.
 *   2. A record that fails validation is dropped, never repaired.
 */

import type {
  EventResult,
  EventStatus,
  EventWithMarkets,
  League,
  Market,
  MarketSelection,
  Participant,
  SportEvent,
} from '../../domain/types.js';
import { categoryForGroup, isCarriedGroup, leagueEditorialFor } from '../../domain/catalog.js';
import { describeMarket } from '../../domain/markets.js';
import { internalEventId, participantIdFor, selectionIdFor } from '../../domain/identity.js';
import { isValidAmericanOdds } from '../../core/odds.js';
import type { RawBookmaker, RawEvent, RawScoreEvent, RawSport } from './raw.js';
import { filterValid, isRawBookmaker, isRawMarket, isRawOutcome } from './raw.js';

export const PROVIDER_NAME = 'the-odds-api';

/* ───────────────────────────── catalogue ───────────────────────────── */

export function normaliseLeague(raw: RawSport): League | null {
  const group = typeof raw.group === 'string' ? raw.group : '';
  if (!isCarriedGroup(group)) return null;

  const category = categoryForGroup(group);
  const editorial = leagueEditorialFor(raw.key, raw.title);

  return {
    id: editorial.id,
    providerKey: raw.key,
    categoryId: category.id,
    name: raw.title.trim(),
    shortName: editorial.shortName,
    description: typeof raw.description === 'string' ? raw.description.trim() : '',
    priority: editorial.priority,
    providerActive: raw.active === true,
    outrightsOnly: raw.has_outrights === true,
    // Season state is derived later, from the events actually returned.
    seasonState: 'UNKNOWN',
    liveEventCount: 0,
    upcomingEventCount: 0,
  };
}

/* ─────────────────────────────── events ────────────────────────────── */

/** Combat sports are billed "A vs B"; team sports "Away @ Home". */
function eventNameFor(categoryId: string, home: string | null, away: string | null): string {
  if (home && away) return categoryId === 'combat' ? `${away} vs ${home}` : `${away} @ ${home}`;
  return home ?? away ?? 'Event';
}

function participantsFor(
  providerLeagueKey: string,
  categoryId: string,
  home: string | null,
  away: string | null,
): Participant[] {
  // In a bout there is no home side, so neither fighter is given one.
  const neutral = categoryId === 'combat';
  const list: Participant[] = [];

  if (away) {
    list.push({
      externalId: participantIdFor(providerLeagueKey, away),
      name: away,
      abbreviation: null,
      role: neutral ? 'NEUTRAL' : 'AWAY',
      imageUrl: null,
      score: null,
    });
  }
  if (home) {
    list.push({
      externalId: participantIdFor(providerLeagueKey, home),
      name: home,
      abbreviation: null,
      role: neutral ? 'NEUTRAL' : 'HOME',
      imageUrl: null,
      score: null,
    });
  }
  return list;
}

/**
 * Status from a schedule-only response.
 *
 * A future start time means UPCOMING. A past one means only that the clock
 * has moved: without a scores response KOVR does not know whether the event
 * is in progress, finished or abandoned, so it says UNKNOWN. Nothing is
 * settled, and no market is quietly left open, on the strength of a guess.
 */
export function statusFromSchedule(commenceTime: string, now: number = Date.now()): EventStatus {
  const start = Date.parse(commenceTime);
  if (!Number.isFinite(start)) return 'UNKNOWN';
  return start > now ? 'UPCOMING' : 'UNKNOWN';
}

export function normaliseEvent(
  raw: RawEvent,
  league: League,
  fetchedAt: string,
  now: number = Date.now(),
): SportEvent | null {
  const home = typeof raw.home_team === 'string' && raw.home_team.trim() !== '' ? raw.home_team.trim() : null;
  const away = typeof raw.away_team === 'string' && raw.away_team.trim() !== '' ? raw.away_team.trim() : null;

  // An event with no identifiable competitor cannot be displayed honestly.
  if (!home && !away) return null;

  const participants = participantsFor(league.providerKey, league.categoryId, home, away);

  return {
    id: internalEventId(PROVIDER_NAME, raw.id),
    providerEventId: raw.id,
    leagueId: league.id,
    categoryId: league.categoryId,
    providerLeagueKey: league.providerKey,
    name: eventNameFor(league.categoryId, home, away),
    // The Odds API does not publish card names such as "UFC 312"; leaving
    // this null is truthful, and the UI falls back to the league name.
    eventTitle: null,
    participants,
    startTime: new Date(raw.commence_time).toISOString(),
    status: statusFromSchedule(raw.commence_time, now),
    periodLabel: null,
    venue: null,
    result: null,
    fight:
      league.categoryId === 'combat'
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
    lastUpdatedAt: fetchedAt,
  };
}

/* ─────────────────────────────── markets ───────────────────────────── */

/**
 * Pick one bookmaker to price the whole event.
 *
 * KOVR presents a single coherent book rather than a best-price composite,
 * so every selection on a card comes from the same source. The configured
 * preference wins when it is present; otherwise the book offering the most
 * markets does, with the key breaking ties so the choice is deterministic
 * across refreshes.
 */
export function chooseBookmaker(
  bookmakers: readonly RawBookmaker[],
  preferredKey: string | null,
): RawBookmaker | null {
  if (bookmakers.length === 0) return null;

  if (preferredKey) {
    const preferred = bookmakers.find((book) => book.key === preferredKey);
    if (preferred) return preferred;
  }

  return [...bookmakers].sort((a, b) => {
    const byMarkets = (b.markets?.length ?? 0) - (a.markets?.length ?? 0);
    return byMarkets !== 0 ? byMarkets : a.key.localeCompare(b.key);
  })[0] ?? null;
}

function selectionFor(
  marketKey: string,
  outcome: { name: string; price: number; point?: number },
  book: RawBookmaker,
  participants: readonly Participant[],
  providerLeagueKey: string,
  priceUpdatedAt: string,
): MarketSelection | null {
  // The provider is asked for American format; a value outside that format
  // is a broken record, so the selection is dropped rather than converted.
  if (!isValidAmericanOdds(outcome.price)) return null;

  const line = typeof outcome.point === 'number' && Number.isFinite(outcome.point) ? outcome.point : null;
  const derivedId = participantIdFor(providerLeagueKey, outcome.name);
  // Only an exact id match links a selection to a competitor. Totals
  // ("Over"/"Under") legitimately match nothing and stay unlinked.
  const linked = participants.find((p) => p.externalId === derivedId);

  return {
    id: selectionIdFor(marketKey, outcome.name, line),
    name: outcome.name.trim(),
    participantExternalId: linked ? linked.externalId : null,
    line,
    price: outcome.price,
    bookmakerKey: book.key,
    bookmakerName: book.title,
    priceUpdatedAt,
  };
}

export function normaliseMarkets(
  raw: RawEvent,
  event: SportEvent,
  preferredBookmaker: string | null,
  fetchedAt: string,
): Market[] {
  const bookmakers = filterValid(raw.bookmakers ?? [], isRawBookmaker);
  const book = chooseBookmaker(bookmakers, preferredBookmaker);
  if (!book) return [];

  const markets: Market[] = [];
  for (const rawMarket of filterValid(book.markets, isRawMarket)) {
    const definition = describeMarket(rawMarket.key);
    const priceUpdatedAt = rawMarket.last_update ?? book.last_update ?? fetchedAt;

    const selections = filterValid(rawMarket.outcomes, isRawOutcome)
      .map((outcome) =>
        selectionFor(
          rawMarket.key,
          outcome,
          book,
          event.participants,
          event.providerLeagueKey,
          priceUpdatedAt,
        ),
      )
      .filter((selection): selection is MarketSelection => selection !== null);

    // A market with nothing priced is not a market.
    if (selections.length === 0) continue;

    markets.push({
      key: rawMarket.key,
      name: definition.name,
      kind: definition.kind,
      selections,
      lastUpdatedAt: priceUpdatedAt,
    });
  }

  return markets.sort((a, b) => describeMarket(a.key).priority - describeMarket(b.key).priority);
}

export function normaliseEventWithMarkets(
  raw: RawEvent,
  league: League,
  preferredBookmaker: string | null,
  fetchedAt: string,
  now: number = Date.now(),
): EventWithMarkets | null {
  const event = normaliseEvent(raw, league, fetchedAt, now);
  if (!event) return null;
  return { event, markets: normaliseMarkets(raw, event, preferredBookmaker, fetchedAt) };
}

/* ─────────────────────────────── results ───────────────────────────── */

function parseScore(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Status from a scores response.
 *
 * `completed` is the provider's own statement that the event is over, and it
 * is the only thing KOVR treats as final. An event that has scores but is not
 * completed is in progress. Anything else is left to the schedule rule.
 */
export function statusFromScores(raw: RawScoreEvent, now: number = Date.now()): EventStatus {
  if (raw.completed === true) return 'FINAL';
  const hasScores = Array.isArray(raw.scores) && raw.scores.length > 0;
  if (hasScores) return 'LIVE';
  return statusFromSchedule(raw.commence_time, now);
}

/**
 * Build a confirmed result — or return null.
 *
 * Returns a result only when the provider marks the event complete AND
 * publishes scores KOVR can actually read. A completed event with unusable
 * scores yields null, which leaves its bets open and surfaces in the admin
 * view: an unsettled bet is recoverable, a wrongly settled one is not.
 */
export function normaliseResult(
  raw: RawScoreEvent,
  providerLeagueKey: string,
  confirmedAtFallback: string,
): EventResult | null {
  if (raw.completed !== true) return null;

  const rawScores = Array.isArray(raw.scores) ? raw.scores : [];
  const scores: Array<{ externalId: string; score: number }> = [];
  for (const entry of rawScores) {
    if (!entry || typeof entry.name !== 'string' || entry.name.trim() === '') continue;
    const score = parseScore(entry.score);
    if (score === null) continue;
    scores.push({ externalId: participantIdFor(providerLeagueKey, entry.name), score });
  }

  // Without at least two readable scores there is no comparison to make.
  if (scores.length < 2) return null;

  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const second = sorted[1];
  if (!best || !second) return null;

  const isDraw = best.score === second.score;

  return {
    winnerExternalId: isDraw ? null : best.externalId,
    isDraw,
    scores,
    confirmedAt: raw.last_update ?? confirmedAtFallback,
    method: null,
  };
}
