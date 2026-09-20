import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseBookmaker,
  normaliseEvent,
  normaliseEventWithMarkets,
  normaliseLeague,
  normaliseResult,
  statusFromSchedule,
  statusFromScores,
} from '../src/providers/theoddsapi/normalize.js';
import type { RawBookmaker, RawEvent, RawScoreEvent, RawSport } from '../src/providers/theoddsapi/raw.js';
import { filterValid, isRawEvent, isRawSport } from '../src/providers/theoddsapi/raw.js';
import { UFC_LEAGUE, NFL_LEAGUE } from './support/fakeProvider.js';
import { participantIdFor } from '../src/domain/identity.js';
import { deriveSeasonState } from '../src/domain/catalog.js';
import { describeMarket } from '../src/domain/markets.js';

const FETCHED_AT = '2026-09-20T12:00:00.000Z';

test('the catalogue carries sports through and drops non-sports', () => {
  const ufc: RawSport = {
    key: 'mma_mixed_martial_arts',
    group: 'Mixed Martial Arts',
    title: 'MMA',
    description: 'Mixed Martial Arts',
    active: true,
    has_outrights: false,
  };
  const league = normaliseLeague(ufc);
  assert.equal(league?.id, 'ufc');
  assert.equal(league?.categoryId, 'combat');
  assert.equal(league?.priority, 1, 'UFC leads its category');

  const politics: RawSport = { ...ufc, key: 'politics_us', group: 'Politics', title: 'US Elections' };
  assert.equal(normaliseLeague(politics), null, 'a sportsbook does not price elections');
});

test('a competition KOVR has never carried still appears', () => {
  const novel: RawSport = {
    key: 'handball_norway_eliteserien',
    group: 'Handball',
    title: 'Norwegian Eliteserien',
    description: 'Handball',
    active: true,
    has_outrights: false,
  };
  const league = normaliseLeague(novel);
  assert.ok(league, 'not dropped for being unknown');
  assert.equal(league.categoryId, 'handball');
  assert.equal(league.shortName, 'Norwegian Eliteserien');
  assert.equal(league.priority, 900, 'sorts after the curated leagues');
});

test('a past start time yields UNKNOWN, never LIVE or FINAL', () => {
  const now = Date.parse('2026-09-20T12:00:00.000Z');
  assert.equal(statusFromSchedule('2026-09-20T18:00:00.000Z', now), 'UPCOMING');
  assert.equal(statusFromSchedule('2026-09-20T06:00:00.000Z', now), 'UNKNOWN');
  assert.equal(statusFromSchedule('not a date', now), 'UNKNOWN');
});

test('status comes from the scores feed, with completion as the only final word', () => {
  const now = Date.parse('2026-09-20T12:00:00.000Z');
  const base: RawScoreEvent = {
    id: 'e1',
    sport_key: 'americanfootball_nfl',
    commence_time: '2026-09-20T10:00:00.000Z',
    completed: false,
  };

  assert.equal(statusFromScores({ ...base, completed: true }, now), 'FINAL');
  assert.equal(
    statusFromScores({ ...base, scores: [{ name: 'Ravens', score: '7' }] }, now),
    'LIVE',
    'scores without completion means in progress',
  );
  assert.equal(statusFromScores(base, now), 'UNKNOWN', 'started, but nothing confirms what is happening');
});

test('a result is built only from a confirmed completion with readable scores', () => {
  const base: RawScoreEvent = {
    id: 'e1',
    sport_key: 'americanfootball_nfl',
    commence_time: '2026-09-20T10:00:00.000Z',
    completed: true,
    scores: [
      { name: 'Ravens', score: '17' },
      { name: 'Chiefs', score: '27' },
    ],
    last_update: '2026-09-20T13:30:00.000Z',
  };

  const result = normaliseResult(base, 'americanfootball_nfl', FETCHED_AT);
  assert.ok(result);
  assert.equal(result.winnerExternalId, participantIdFor('americanfootball_nfl', 'Chiefs'));
  assert.equal(result.isDraw, false);
  assert.equal(result.confirmedAt, '2026-09-20T13:30:00.000Z');

  assert.equal(normaliseResult({ ...base, completed: false }, 'americanfootball_nfl', FETCHED_AT), null,
    'not complete means no result');
  assert.equal(normaliseResult({ ...base, scores: null }, 'americanfootball_nfl', FETCHED_AT), null,
    'complete but no scores means no result');
  assert.equal(
    normaliseResult({ ...base, scores: [{ name: 'Ravens', score: 'n/a' }, { name: 'Chiefs', score: null }] },
      'americanfootball_nfl', FETCHED_AT),
    null,
    'unreadable scores mean no result',
  );

  const drawn = normaliseResult(
    { ...base, scores: [{ name: 'Ravens', score: '20' }, { name: 'Chiefs', score: '20' }] },
    'americanfootball_nfl',
    FETCHED_AT,
  );
  assert.equal(drawn?.isDraw, true);
  assert.equal(drawn?.winnerExternalId, null);
});

test('one bookmaker prices the whole card, chosen deterministically', () => {
  const books: RawBookmaker[] = [
    { key: 'zeta', title: 'Zeta', markets: [{ key: 'h2h', outcomes: [] }] },
    { key: 'alpha', title: 'Alpha', markets: [{ key: 'h2h', outcomes: [] }] },
    { key: 'beta', title: 'Beta', markets: [{ key: 'h2h', outcomes: [] }, { key: 'totals', outcomes: [] }] },
  ];

  assert.equal(chooseBookmaker(books, null)?.key, 'beta', 'the deepest book wins');
  assert.equal(chooseBookmaker(books, 'alpha')?.key, 'alpha', 'a configured preference wins');
  assert.equal(chooseBookmaker(books, 'missing')?.key, 'beta', 'an absent preference falls back');
  assert.equal(chooseBookmaker([], null), null);

  const tied: RawBookmaker[] = [
    { key: 'zeta', title: 'Zeta', markets: [{ key: 'h2h', outcomes: [] }] },
    { key: 'alpha', title: 'Alpha', markets: [{ key: 'h2h', outcomes: [] }] },
  ];
  assert.equal(chooseBookmaker(tied, null)?.key, 'alpha', 'ties break the same way every refresh');
});

test('event and market normalisation links selections to competitors by id', () => {
  const raw: RawEvent = {
    id: 'evt-1',
    sport_key: 'americanfootball_nfl',
    commence_time: '2099-01-01T00:00:00.000Z',
    home_team: 'Kansas City Chiefs',
    away_team: 'Baltimore Ravens',
    bookmakers: [
      {
        key: 'testbook',
        title: 'Test Book',
        last_update: FETCHED_AT,
        markets: [
          {
            key: 'h2h',
            last_update: FETCHED_AT,
            outcomes: [
              { name: 'Baltimore Ravens', price: -125 },
              { name: 'Kansas City Chiefs', price: 105 },
            ],
          },
          {
            key: 'totals',
            last_update: FETCHED_AT,
            outcomes: [
              { name: 'Over', price: -110, point: 47.5 },
              { name: 'Under', price: -110, point: 47.5 },
            ],
          },
        ],
      },
    ],
  };

  const normalised = normaliseEventWithMarkets(raw, NFL_LEAGUE, null, FETCHED_AT);
  assert.ok(normalised);
  assert.equal(normalised.event.name, 'Baltimore Ravens @ Kansas City Chiefs');
  assert.equal(normalised.event.status, 'UPCOMING');
  assert.equal(normalised.event.participants[0]?.role, 'AWAY');
  assert.equal(normalised.event.participants[1]?.role, 'HOME');

  const moneyline = normalised.markets.find((m) => m.key === 'h2h');
  assert.equal(moneyline?.selections[0]?.price, -125);
  assert.equal(
    moneyline?.selections[0]?.participantExternalId,
    participantIdFor('americanfootball_nfl', 'Baltimore Ravens'),
    'the price is bound to a competitor id, not a name',
  );

  const totals = normalised.markets.find((m) => m.key === 'totals');
  assert.equal(totals?.selections[0]?.line, 47.5);
  assert.equal(totals?.selections[0]?.participantExternalId, null, 'Over belongs to no competitor');
});

test('a bout has no home side', () => {
  const raw: RawEvent = {
    id: 'evt-mma',
    sport_key: 'mma_mixed_martial_arts',
    commence_time: '2099-01-01T00:00:00.000Z',
    home_team: 'Fighter A',
    away_team: 'Fighter B',
  };
  const event = normaliseEvent(raw, UFC_LEAGUE, FETCHED_AT);
  assert.equal(event?.name, 'Fighter B vs Fighter A');
  assert.ok(event?.participants.every((p) => p.role === 'NEUTRAL'));
  assert.ok(event?.fight, 'combat events carry fight detail');
  assert.equal(event?.fight?.weightClass, null, 'unsupplied detail stays null rather than invented');
});

test('malformed provider records are dropped, not repaired', () => {
  const payload: unknown = [
    { id: 'ok', sport_key: 'x', commence_time: '2099-01-01T00:00:00Z', home_team: 'A', away_team: 'B' },
    { id: '', sport_key: 'x', commence_time: '2099-01-01T00:00:00Z' },
    { id: 'no-time', sport_key: 'x' },
    { id: 'bad-time', sport_key: 'x', commence_time: 'yesterday' },
    null,
    'a string',
    42,
  ];
  const valid = filterValid(payload, isRawEvent);
  assert.equal(valid.length, 1);
  assert.equal(valid[0]?.id, 'ok');

  assert.deepEqual(filterValid(null, isRawSport), [], 'a non-array body yields nothing');
  assert.deepEqual(filterValid({ error: 'nope' }, isRawSport), []);
});

test('a price outside American format is dropped rather than converted', () => {
  const raw: RawEvent = {
    id: 'evt-bad-price',
    sport_key: 'americanfootball_nfl',
    commence_time: '2099-01-01T00:00:00.000Z',
    home_team: 'Home',
    away_team: 'Away',
    bookmakers: [
      {
        key: 'testbook',
        title: 'Test Book',
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: 'Away', price: 1.91 },
              { name: 'Home', price: -110 },
            ],
          },
        ],
      },
    ],
  };
  const normalised = normaliseEventWithMarkets(raw, NFL_LEAGUE, null, FETCHED_AT);
  const moneyline = normalised?.markets.find((m) => m.key === 'h2h');
  assert.equal(moneyline?.selections.length, 1, 'the decimal price is gone');
  assert.equal(moneyline?.selections[0]?.name, 'Home');
});

test('an event with no identifiable competitor is not displayed', () => {
  const raw: RawEvent = { id: 'evt-empty', sport_key: 'x', commence_time: '2099-01-01T00:00:00.000Z' };
  assert.equal(normaliseEvent(raw, NFL_LEAGUE, FETCHED_AT), null);
});

test('unknown market keys are shown rather than filtered out', () => {
  assert.equal(describeMarket('h2h').name, 'Moneyline');
  assert.equal(describeMarket('player_pass_tds').kind, 'PLAYER_PROP');
  assert.equal(describeMarket('player_pass_tds').name, 'Player Pass Tds');
  const novel = describeMarket('some_future_market_kovr_has_never_seen');
  assert.equal(novel.kind, 'OTHER');
  assert.equal(novel.name, 'Some Future Market Kovr Has Never Seen');
});

test('season state is read off the events, not a calendar', () => {
  assert.equal(
    deriveSeasonState({ providerActive: true, liveEventCount: 2, upcomingEventCount: 9, hasOdds: true, daysToNextEvent: 0 }),
    'LIVE',
  );
  assert.equal(
    deriveSeasonState({ providerActive: true, liveEventCount: 0, upcomingEventCount: 14, hasOdds: true, daysToNextEvent: 2 }),
    'ACTIVE',
  );
  assert.equal(
    deriveSeasonState({ providerActive: true, liveEventCount: 0, upcomingEventCount: 3, hasOdds: true, daysToNextEvent: 60 }),
    'UPCOMING',
    'fixtures two months out are next season, not this one',
  );
  assert.equal(
    deriveSeasonState({ providerActive: true, liveEventCount: 0, upcomingEventCount: 5, hasOdds: false, daysToNextEvent: 1 }),
    'NO_ODDS_AVAILABLE',
  );
  assert.equal(
    deriveSeasonState({ providerActive: false, liveEventCount: 0, upcomingEventCount: 0, hasOdds: false, daysToNextEvent: null }),
    'OFFSEASON',
  );
  assert.equal(
    deriveSeasonState({ providerActive: true, liveEventCount: 0, upcomingEventCount: 0, hasOdds: false, daysToNextEvent: null }),
    'NO_CURRENT_EVENTS',
  );
});
