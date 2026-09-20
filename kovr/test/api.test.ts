import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createContext } from '../src/runtime/context.js';
import { createKovrServer } from '../src/http/server.js';
import { FakeProvider, UFC_LEAGUE, buildEvent, isoIn, moneylineMarket } from './support/fakeProvider.js';

async function serve(provider = new FakeProvider()) {
  const context = createContext(provider);
  const server = createKovrServer(context);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    provider,
    context,
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function seedFight(provider: FakeProvider) {
  const event = buildEvent({
    providerEventId: 'api-ufc-1',
    league: UFC_LEAGUE,
    competitors: ['Fighter B', 'Fighter A'],
    startTime: isoIn(6),
  });
  const market = moneylineMarket(event, [125, -150]);
  provider.setLeagueEvents(UFC_LEAGUE.providerKey, [{ event, markets: [market] }]);
  return { event, market };
}

test('the public config carries no secret', async () => {
  const served = await serve();
  try {
    const response = await fetch(`${served.base}/api/config`);
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(response.status, 200);
    assert.equal(typeof body['providerConfigured'], 'boolean');
    assert.ok(!/apiKey|api_key|secret|token/i.test(JSON.stringify(body)));
  } finally {
    await served.close();
  }
});

test('the feed serves events with their headline prices and a hero', async () => {
  const served = await serve();
  try {
    seedFight(served.provider);
    const response = await fetch(`${served.base}/api/feed`);
    const body = (await response.json()) as Record<string, unknown>;
    const data = body['data'] as {
      totalEvents: number;
      headline: { event: { statusLabel: string }; markets: unknown[] } | null;
      leagues: unknown[];
    };

    assert.equal(response.status, 200);
    assert.equal(data.totalEvents, 1);
    assert.ok(data.headline, 'the hub leads with something');
    assert.ok(data.headline.markets.length > 0, 'the hero is priced without a second call');
    assert.equal(data.headline.event.statusLabel, 'Upcoming');
    assert.equal(data.leagues.length, 1, 'the filter rail lists what is on');
  } finally {
    await served.close();
  }
});

test('feed responses are cacheable at the edge, settlement reads are not', async () => {
  const served = await serve();
  try {
    seedFight(served.provider);

    const feed = await fetch(`${served.base}/api/feed`);
    assert.match(feed.headers.get('cache-control') ?? '', /s-maxage=\d+/);

    const settlement = await fetch(`${served.base}/api/settlement`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ eventIds: [] }),
    });
    assert.equal(settlement.headers.get('cache-control'), 'no-store');
  } finally {
    await served.close();
  }
});

test('an event resolves straight from its id, with no database behind it', async () => {
  const served = await serve();
  try {
    const { event } = seedFight(served.provider);
    const response = await fetch(`${served.base}/api/event/${encodeURIComponent(event.id)}`);
    const body = (await response.json()) as Record<string, unknown>;
    const data = body['data'] as { event: { id: string; name: string }; markets: Array<{ key: string }> };

    assert.equal(response.status, 200);
    assert.equal(data.event.id, event.id);
    assert.equal(data.event.name, 'Fighter B vs Fighter A');
    assert.ok(data.markets.some((market) => market.key === 'h2h'));
  } finally {
    await served.close();
  }
});

test('settlement facts come back only for events the provider reported on', async () => {
  const served = await serve();
  try {
    const { event } = seedFight(served.provider);
    served.provider.statuses.set(UFC_LEAGUE.providerKey, [
      { providerEventId: event.providerEventId, status: 'LIVE' },
    ]);

    const response = await fetch(`${served.base}/api/settlement`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ eventIds: [event.id, 'evt_bm90LWEtcmVhbC1ldmVudA'] }),
    });
    const body = (await response.json()) as Record<string, unknown>;
    const data = body['data'] as Array<{ id: string; status: string }>;

    assert.equal(data.length, 1, 'the unknown event is absent, not invented');
    assert.equal(data[0]?.id, event.id);
    assert.equal(data[0]?.status, 'LIVE');
  } finally {
    await served.close();
  }
});

test('unknown competitions, events and endpoints answer 404', async () => {
  const served = await serve();
  try {
    assert.equal((await fetch(`${served.base}/api/league/not-a-league`)).status, 404);
    assert.equal((await fetch(`${served.base}/api/event/evt_bm9wZXw`)).status, 404);
    assert.equal((await fetch(`${served.base}/api/event/garbage`)).status, 404);
    assert.equal((await fetch(`${served.base}/api/nope`)).status, 404);
  } finally {
    await served.close();
  }
});

test('bad input is rejected with a code, not a 500', async () => {
  const served = await serve();
  try {
    const missing = await fetch(`${served.base}/api/settlement`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(missing.status, 400);
    assert.equal(((await missing.json()) as { code: string }).code, 'INVALID_FIELD');

    const broken = await fetch(`${served.base}/api/settlement`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    assert.equal(broken.status, 400);
  } finally {
    await served.close();
  }
});

test('the shell is served and directory traversal is refused', async () => {
  const served = await serve();
  try {
    const shell = await fetch(`${served.base}/`);
    assert.equal(shell.status, 200);
    assert.match(shell.headers.get('content-type') ?? '', /text\/html/);
    assert.match(await shell.text(), /KOVR/);
    assert.equal((await fetch(`${served.base}/manifest.webmanifest`)).status, 200);

    for (const path of ['/../package.json', '/../../etc/passwd', '/..%2f..%2fpackage.json']) {
      const response = await fetch(`${served.base}${path}`, { redirect: 'manual' });
      assert.ok(response.status === 404 || response.status === 301, `${path} must not serve a file`);
      if (response.status === 404) assert.ok(!(await response.text()).includes('kovr-sports'));
    }
  } finally {
    await served.close();
  }
});
