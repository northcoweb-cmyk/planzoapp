import test from 'node:test';
import assert from 'node:assert/strict';
import { RefreshManager } from '../src/services/refreshManager.js';
import { MemoryCacheStore, RequestLog } from '../src/runtime/cache.js';
import { ProviderError } from '../src/providers/SportsDataProvider.js';
import { buildFreshness, STALE_AFTER_MS } from '../src/domain/status.js';

test('a fresh cache entry is served without calling the provider again', async () => {
  const refresh = new RefreshManager(new MemoryCacheStore());
  let calls = 0;
  const loader = async () => ({ value: ++calls });

  const first = await refresh.load('k', 'schedule', 'schedule', loader);
  const second = await refresh.load('k', 'schedule', 'schedule', loader);

  assert.equal(calls, 1, 'the second read came from cache');
  assert.deepEqual(first.data, { value: 1 });
  assert.deepEqual(second.data, { value: 1 });
});

test('concurrent readers share one in-flight request', async () => {
  const refresh = new RefreshManager(new MemoryCacheStore());
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
  assert.equal(refresh.inFlightCount(), 0);
});

test('an outage serves the last good payload, labelled as cache', async () => {
  const refresh = new RefreshManager(new MemoryCacheStore());
  let healthy = true;
  const loader = async () => {
    if (!healthy) throw new ProviderError('NETWORK', 'connection reset');
    return { odds: -150 };
  };

  assert.equal((await refresh.load('odds', 'liveOdds', 'liveOdds', loader)).freshness.source, 'live');

  healthy = false;
  const degraded = await refresh.load('odds', 'liveOdds', 'liveOdds', loader, { forceRefresh: true });

  assert.deepEqual(degraded.data, { odds: -150 }, 'the last known price survives');
  assert.equal(degraded.freshness.source, 'cache');
  assert.equal(degraded.freshness.error, 'The sports data provider could not be reached.');
  assert.ok(degraded.freshness.lastUpdatedAt);
});

test('an outage with nothing cached reports unavailable and returns no data', async () => {
  const refresh = new RefreshManager(new MemoryCacheStore());
  const result = await refresh.load('cold', 'liveOdds', 'liveOdds', async () => {
    throw new ProviderError('NOT_CONFIGURED', 'no key');
  });

  assert.equal(result.data, null, 'nothing was invented to fill the gap');
  assert.equal(result.freshness.source, 'unavailable');
  assert.ok(result.freshness.stale);
  assert.equal(result.freshness.error, 'No sports data provider is configured.');
});

test('provider failures are described without leaking anything', () => {
  assert.equal(
    RefreshManager.describe(new ProviderError('AUTH_FAILED', 'apiKey=abcdef rejected')),
    'The sports data provider rejected the configured credentials.',
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
  assert.equal(buildFreshness('unavailable', null, 'liveOdds', 'down', now).stale, true);
});

test('the cache is bounded so a long-lived process cannot grow without limit', () => {
  const store = new MemoryCacheStore(3);
  const future = new Date(Date.now() + 60_000).toISOString();
  for (const key of ['a', 'b', 'c', 'd', 'e']) {
    store.set(key, { payload: key, fetchedAt: 'now', expiresAt: future });
  }
  assert.equal(store.size(), 3);
  assert.equal(store.getStale('a'), null, 'the oldest was evicted');
  assert.equal(store.getStale('e')?.payload, 'e');
});

test('the request log answers the budget question', () => {
  const log = new RequestLog();
  const now = Date.now();
  const record = (minutesAgo: number) => ({
    endpoint: '/sports',
    requestedAt: new Date(now - minutesAgo * 60_000).toISOString(),
    durationMs: 10,
    httpStatus: 200,
    ok: true,
    error: null,
    quotaRemaining: 100,
    quotaUsed: 1,
  });

  log.record(record(90));
  log.record(record(30));
  log.record(record(5));

  const hourAgo = new Date(now - 60 * 60_000).toISOString();
  assert.equal(log.countSince(hourAgo), 2, 'only the trailing hour counts');
  assert.equal(log.recent(2).length, 2);
});
