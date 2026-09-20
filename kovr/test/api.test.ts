import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createKovrServer } from '../src/http/server.js';
import { createHarness } from './support/harness.js';
import type { Harness } from './support/harness.js';
import { UFC_LEAGUE, buildEvent, isoIn, moneylineMarket } from './support/fakeProvider.js';
import { resetConfigCache } from '../src/config/env.js';

interface Served {
  harness: Harness;
  base: string;
  close: () => Promise<void>;
}

async function serve(): Promise<Served> {
  const harness = createHarness();
  const server = createKovrServer(harness.context);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    harness,
    base: `http://127.0.0.1:${port}`,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      harness.close();
    },
  };
}

async function call(
  base: string,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await response.text();
  return { status: response.status, body: text ? (JSON.parse(text) as Record<string, unknown>) : {} };
}

function seedFight(served: Served) {
  const event = buildEvent({
    providerEventId: 'api-ufc-1',
    league: UFC_LEAGUE,
    competitors: ['Fighter B', 'Fighter A'],
    startTime: isoIn(6),
  });
  const market = moneylineMarket(event, [125, -150]);
  served.harness.seed(UFC_LEAGUE, [{ event, markets: [market] }]);
  served.harness.context.wallet.ensureDemoAccount();
  return { event, market };
}

test('the public config carries no secret', async () => {
  const served = await serve();
  try {
    const { status, body } = await call(served.base, '/api/config');
    assert.equal(status, 200);
    assert.equal(body['simulated'], true);

    const serialised = JSON.stringify(body);
    assert.ok(!/apiKey|api_key|secret|token/i.test(serialised), 'no credential-shaped field');
    // providerConfigured is a boolean, never the key itself.
    assert.equal(typeof body['providerConfigured'], 'boolean');
  } finally {
    await served.close();
  }
});

test('the home feed serves events with their headline prices', async () => {
  const served = await serve();
  try {
    seedFight(served);
    const { status, body } = await call(served.base, '/api/home');
    assert.equal(status, 200);

    const data = body['data'] as { byLeague: Array<{ events: Array<{ markets: unknown[] }> }> };
    assert.ok(data.byLeague.length > 0);
    assert.ok((data.byLeague[0]?.events[0]?.markets.length ?? 0) > 0, 'a card can be priced without a second call');
    assert.ok(body['freshness']);
    assert.ok(body['wallet']);
  } finally {
    await served.close();
  }
});

test('placing a bet over HTTP debits the wallet', async () => {
  const served = await serve();
  try {
    const { event, market } = seedFight(served);
    const pick = market.selections[1];
    assert.ok(pick);

    const { status, body } = await call(served.base, '/api/bets', {
      method: 'POST',
      body: JSON.stringify({
        selections: [{ eventId: event.id, marketKey: 'h2h', selectionId: pick.id, displayedPrice: -150 }],
        stakeCents: 10_000,
      }),
    });

    assert.equal(status, 200);
    const data = body['data'] as { bet: { status: string; potentialPayoutCents: number }; wallet: { balanceCents: number } };
    assert.equal(data.bet.status, 'OPEN');
    assert.equal(data.bet.potentialPayoutCents, 16_667);
    assert.equal(data.wallet.balanceCents, 990_000);
  } finally {
    await served.close();
  }
});

test('a moved price answers 409 with the change, and places nothing', async () => {
  const served = await serve();
  try {
    const { event, market } = seedFight(served);
    const pick = market.selections[1];
    assert.ok(pick);

    served.harness.context.repositories.events.saveMarkets(
      event.id,
      [moneylineMarket(event, [140, -175])],
      new Date().toISOString(),
    );

    const payload = {
      selections: [{ eventId: event.id, marketKey: 'h2h', selectionId: pick.id, displayedPrice: -150 }],
      stakeCents: 10_000,
    };

    const refused = await call(served.base, '/api/bets', { method: 'POST', body: JSON.stringify(payload) });
    assert.equal(refused.status, 409);
    assert.equal(refused.body['code'], 'ODDS_CHANGED');
    const changes = refused.body['changes'] as Array<{ previousPrice: number; currentPrice: number }>;
    assert.equal(changes[0]?.previousPrice, -150);
    assert.equal(changes[0]?.currentPrice, -175);

    const wallet = await call(served.base, '/api/wallet');
    assert.equal((wallet.body['data'] as { balanceCents: number }).balanceCents, 1_000_000);

    // Accepting places at the current price.
    const accepted = await call(served.base, '/api/bets', {
      method: 'POST',
      body: JSON.stringify({ ...payload, acceptCurrentOdds: true }),
    });
    assert.equal(accepted.status, 200);
    const bet = (accepted.body['data'] as { bet: { priceAmerican: number } }).bet;
    assert.equal(bet.priceAmerican, -175);
  } finally {
    await served.close();
  }
});

test('bad input is rejected with a specific code, not a 500', async () => {
  const served = await serve();
  try {
    const cases: Array<[string, unknown, number]> = [
      ['/api/bets', { selections: [], stakeCents: 1000 }, 400],
      ['/api/bets', { selections: [{ eventId: 'x', marketKey: 'h2h', selectionId: 'y', displayedPrice: 5 }], stakeCents: 1000 }, 400],
      ['/api/wallet/deposit', { amountCents: -500 }, 400],
      ['/api/wallet/withdraw', { amountCents: 0 }, 400],
    ];

    for (const [path, payload, expected] of cases) {
      const { status, body } = await call(served.base, path, { method: 'POST', body: JSON.stringify(payload) });
      assert.equal(status, expected, `${path} ${JSON.stringify(payload)}`);
      assert.ok(typeof body['code'] === 'string', 'carries a machine-readable code');
    }

    const badJson = await fetch(`${served.base}/api/bets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    assert.equal(badJson.status, 400);
  } finally {
    await served.close();
  }
});

test('unknown competitions and events answer 404', async () => {
  const served = await serve();
  try {
    assert.equal((await call(served.base, '/api/sports/not-a-league/events')).status, 404);
    assert.equal((await call(served.base, '/api/events/evt_missing')).status, 404);
    assert.equal((await call(served.base, '/api/nope')).status, 404);
  } finally {
    await served.close();
  }
});

test('the developer surface is closed unless the environment opens it', async () => {
  const previous = process.env['KOVR_ADMIN_ENABLED'];
  process.env['KOVR_ADMIN_ENABLED'] = '0';
  resetConfigCache();

  const served = await serve();
  try {
    for (const path of ['/api/admin/status', '/api/admin/refresh', '/api/admin/reset']) {
      const method = path === '/api/admin/status' ? 'GET' : 'POST';
      const { status } = await call(served.base, path, { method, body: method === 'POST' ? '{}' : undefined });
      assert.equal(status, 404, `${path} should not exist when admin is disabled`);
    }

    process.env['KOVR_ADMIN_ENABLED'] = '1';
    resetConfigCache();
    const opened = await call(served.base, '/api/admin/status');
    assert.equal(opened.status, 200);
    // Even when open, it reports only whether a key exists.
    assert.ok(!/e5025|apiKey=/i.test(JSON.stringify(opened.body)), 'no credential is exposed');
  } finally {
    await served.close();
    if (previous === undefined) delete process.env['KOVR_ADMIN_ENABLED'];
    else process.env['KOVR_ADMIN_ENABLED'] = previous;
    resetConfigCache();
  }
});

test('the static shell is served and directory traversal is refused', async () => {
  const served = await serve();
  try {
    const shell = await fetch(`${served.base}/`);
    assert.equal(shell.status, 200);
    assert.match(shell.headers.get('content-type') ?? '', /text\/html/);
    assert.match(await shell.text(), /KOVR Sports/);

    assert.equal((await fetch(`${served.base}/manifest.webmanifest`)).status, 200);

    for (const path of ['/../package.json', '/../../etc/passwd', '/..%2f..%2fpackage.json']) {
      const response = await fetch(`${served.base}${path}`, { redirect: 'manual' });
      assert.ok(response.status === 404 || response.status === 301, `${path} must not serve a file`);
      if (response.status === 404) {
        assert.ok(!(await response.text()).includes('kovr-sports'), 'no project file leaked');
      }
    }
  } finally {
    await served.close();
  }
});
