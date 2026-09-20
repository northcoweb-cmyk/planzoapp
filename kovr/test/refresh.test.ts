import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './support/harness.js';
import { RefreshManager } from '../src/services/refreshManager.js';
import { MetaRepository } from '../src/store/repositories/metaRepo.js';
import { createInMemoryDatabase } from '../src/store/db.js';
import { ProviderError } from '../src/providers/SportsDataProvider.js';
import { UFC_LEAGUE, buildEvent, isoIn, moneylineMarket } from './support/fakeProvider.js';
import { buildFreshness, STALE_AFTER_MS } from '../src/domain/status.js';

test('a fresh cache entry is served without calling the provider again', async () => {
  const database = createInMemoryDatabase();
  try {
    const refresh = new RefreshManager(new MetaRepository(database));
    let calls = 0;
    const loader = async () => {
      calls++;
      return { value: calls };
    };

    const first = await refresh.load('k', 'schedule', 'schedule', loader);
    const second = await refresh.load('k', 'schedule', 'schedule', loader);

    assert.equal(calls, 1, 'the second read came from cache');
    assert.deepEqual(first.data, { value: 1 });
    assert.deepEqual(second.data, { value: 1 });
    assert.equal(second.freshness.source, 'live');
  } finally {
    database.close();
  }
});

test('concurrent readers share one in-flight request', async () => {
  const database = createInMemoryDatabase();
  try {
    const refresh = new RefreshManager(new MetaRepository(database));
    let calls = 0;
    const loader = async () => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { value: 'shared' };
    };

    const results = await Promise.all([
      refresh.load('dedup', 'liveOdds', 'liveOdds', loader),
      refresh.load('dedup', 'liveOdds', 'liveOdds', loader),
      refresh.load('dedup', 'liveOdds', 'liveOdds', loader),
    ]);

    assert.equal(calls, 1, 'three readers, one provider call');
    for (const result of results) assert.deepEqual(result.data, { value: 'shared' });
    assert.equal(refresh.inFlightCount(), 0, 'the slot is released afterwards');
  } finally {
    database.close();
  }
});

test('an outage serves the last good payload, labelled as cache', async () => {
  const database = createInMemoryDatabase();
  try {
    const refresh = new RefreshManager(new MetaRepository(database));
    let healthy = true;
    const loader = async () => {
      if (!healthy) throw new ProviderError('NETWORK', 'connection reset');
      return { odds: -150 };
    };

    const good = await refresh.load('odds:ufc', 'liveOdds', 'liveOdds', loader);
    assert.equal(good.freshness.source, 'live');

    healthy = false;
    const degraded = await refresh.load('odds:ufc', 'liveOdds', 'liveOdds', loader, { forceRefresh: true });

    assert.deepEqual(degraded.data, { odds: -150 }, 'the last known price survives');
    assert.equal(degraded.freshness.source, 'cache');
    assert.equal(degraded.freshness.error, 'The sports data provider could not be reached.');
    assert.ok(degraded.freshness.lastUpdatedAt, 'the UI can say when this was true');
  } finally {
    database.close();
  }
});

test('an outage with nothing cached reports unavailable and returns no data', async () => {
  const database = createInMemoryDatabase();
  try {
    const refresh = new RefreshManager(new MetaRepository(database));
    const result = await refresh.load('cold', 'liveOdds', 'liveOdds', async () => {
      throw new ProviderError('NOT_CONFIGURED', 'no key');
    });

    assert.equal(result.data, null, 'nothing was invented to fill the gap');
    assert.equal(result.freshness.source, 'unavailable');
    assert.ok(result.freshness.stale);
    assert.equal(result.freshness.error, 'No sports data provider is configured.');
  } finally {
    database.close();
  }
});

test('provider failures are described without leaking anything', async () => {
  assert.equal(
    RefreshManager.describe(new ProviderError('AUTH_FAILED', 'apiKey=abcdef rejected')),
    'The sports data provider rejected the configured credentials.',
  );
  assert.equal(
    RefreshManager.describe(new ProviderError('BUDGET_EXCEEDED', 'spent')),
    "KOVR has reached its configured hourly provider request budget.",
  );
  const other = RefreshManager.describe(new Error('failed calling https://x/y?apiKey=SECRETVALUE&z=1'));
  assert.ok(!other.includes('SECRETVALUE'), 'a key in a message is redacted');
  assert.ok(other.includes('[redacted]'));
});

test('data older than its class threshold is marked stale', () => {
  const now = Date.parse('2026-09-20T12:00:00.000Z');
  const recent = new Date(now - 10_000).toISOString();
  const old = new Date(now - STALE_AFTER_MS.liveOdds - 1000).toISOString();

  assert.equal(buildFreshness('live', recent, 'liveOdds', null, now).stale, false);
  assert.equal(buildFreshness('live', old, 'liveOdds', null, now).stale, true);
  assert.equal(buildFreshness('cache', recent, 'schedule', null, now).stale, false);
  assert.equal(buildFreshness('unavailable', null, 'liveOdds', 'down', now).stale, true);
});

test('a league sync survives an outage and keeps serving what it already has', async () => {
  const h = createHarness();
  try {
    const event = buildEvent({
      providerEventId: 'ufc-outage',
      league: UFC_LEAGUE,
      competitors: ['Fighter J', 'Fighter I'],
      startTime: isoIn(8),
    });
    h.seed(UFC_LEAGUE, [{ event, markets: [moneylineMarket(event, [115, -135])] }]);

    const healthy = await h.context.sports.syncLeague('ufc', { force: true });
    assert.equal(healthy.source, 'live');
    assert.equal(healthy.events, 1);

    h.provider.failure = new ProviderError('NETWORK', 'provider down');
    const degraded = await h.context.sports.syncLeague('ufc', { force: true });
    assert.equal(degraded.source, 'cache');
    assert.ok(degraded.error);

    // The event is still readable, and still labelled for what it is.
    const feed = h.context.sports.getLeagueEvents('ufc');
    assert.equal(feed.data.length, 1);
    assert.equal(feed.data[0]?.name, 'Fighter J vs Fighter I');
  } finally {
    h.close();
  }
});

test('an unconfigured provider yields an honest unavailable state', async () => {
  const h = createHarness();
  try {
    h.provider.failure = new ProviderError('NOT_CONFIGURED', 'no key set');
    const catalogue = await h.context.sports.syncCatalog({ force: true });

    assert.equal(catalogue.freshness.source, 'unavailable');
    assert.equal(catalogue.freshness.error, 'No sports data provider is configured.');
    assert.deepEqual(catalogue.data, [], 'an empty catalogue, not a fabricated one');
  } finally {
    h.close();
  }
});
