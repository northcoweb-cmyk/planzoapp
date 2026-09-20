/**
 * The end-to-end path, across the split runtime:
 *
 *   the sports API serves a real-shaped card -> the ledger places a bet at
 *   the shown price -> the market moves -> the placed bet keeps its price ->
 *   the provider confirms a winner -> the ledger settles -> the correct
 *   payout lands -> the ledger reconciles -> repeat sweeps change nothing.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createContext } from '../src/runtime/context.js';
import { createKovrServer } from '../src/http/server.js';
import { createLedger } from './support/ledgerHarness.js';
import {
  FakeProvider,
  UFC_LEAGUE,
  buildEvent,
  isoIn,
  moneylineMarket,
  resultFor,
} from './support/fakeProvider.js';
import { ProviderError } from '../src/providers/SportsDataProvider.js';
import { formatCents } from '../src/core/money.js';
import { formatAmericanOdds } from '../src/core/odds.js';
import type { EventWithMarkets } from '../src/domain/types.js';

async function serve(provider: FakeProvider) {
  const context = createContext(provider);
  const server = createKovrServer(context);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    context,
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function getJson(base: string, path: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${base}${path}`);
  return (await response.json()) as Record<string, unknown>;
}

test('UFC: from an empty account to a reconciled payout', async () => {
  const provider = new FakeProvider();
  const fight = buildEvent({
    providerEventId: 'ufc-312-main',
    league: UFC_LEAGUE,
    competitors: ['Fighter B', 'Fighter A'],
    startTime: isoIn(5),
  });
  provider.setLeagueEvents(UFC_LEAGUE.providerKey, [{ event: fight, markets: [moneylineMarket(fight, [125, -150])] }]);

  const served = await serve(provider);
  const ledger = createLedger();

  try {
    /* 1. A new account opens at $10,000, entirely from the ledger. */
    assert.equal((await ledger.wallet()).balanceCents, 1_000_000);
    assert.equal(formatCents((await ledger.wallet()).balanceCents), '$10,000.00');

    /* 2. The feed serves the card the interface would render. */
    const feed = await getJson(served.base, '/api/feed');
    const data = feed['data'] as { totalEvents: number; headline: { event: { id: string } } | null };
    assert.equal(data.totalEvents, 1);
    assert.ok(data.headline, 'the hub leads with an event');

    /* 3. Fighter A shows at -150 in the event's market. */
    const eventResponse = await getJson(served.base, `/api/event/${encodeURIComponent(fight.id)}`);
    const detail = eventResponse['data'] as { markets: EventWithMarkets['markets'] };
    const moneyline = detail.markets.find((market) => market.key === 'h2h');
    const fighterA = moneyline?.selections.find((selection) => selection.name === 'Fighter A');
    assert.ok(fighterA);
    assert.equal(fighterA.price, -150);
    assert.equal(formatAmericanOdds(fighterA.price), '-150');

    /* 4. $100 on Fighter A at the displayed price. */
    const live = new Map<string, EventWithMarkets>([[fight.id, { event: fight, markets: detail.markets }]]);
    const placed = await ledger.place(
      {
        selections: [{ eventId: fight.id, marketKey: 'h2h', selectionId: fighterA.id, displayedPrice: -150 }],
        stakeCents: 10_000,
      },
      live,
    );
    assert.ok(placed.ok);
    if (!placed.ok) return;

    /* 5. The balance falls by exactly the stake; the bet is OPEN. */
    assert.equal(placed.wallet.balanceCents, 990_000);
    assert.equal(placed.bet.status, 'OPEN');
    assert.equal(placed.bet.potentialPayoutCents, 16_667);
    assert.equal(formatCents(placed.bet.potentialPayoutCents), '$166.67');

    /* 6. The market moves. Hard. */
    const moved = new Map<string, EventWithMarkets>([
      [fight.id, { event: fight, markets: [moneylineMarket(fight, [180, -240])] }],
    ]);
    const refused = await ledger.place(
      {
        selections: [{ eventId: fight.id, marketKey: 'h2h', selectionId: fighterA.id, displayedPrice: -150 }],
        stakeCents: 5_000,
      },
      moved,
    );
    assert.ok(!refused.ok);
    if (!refused.ok) assert.equal(refused.code, 'ODDS_CHANGED');

    /* 7. The placed bet is untouched by any of it. */
    const held = await ledger.findBet(placed.bet.id);
    assert.equal(held?.priceAmerican, -150);
    assert.equal(held?.selections[0]?.priceAmerican, -150);
    assert.equal(held?.potentialPayoutCents, 16_667);
    assert.equal(held?.status, 'OPEN');

    /* 8. The fight ends. Before a confirmed result, nothing settles. */
    provider.statuses.set(UFC_LEAGUE.providerKey, [{ providerEventId: fight.providerEventId, status: 'UNKNOWN' }]);
    const early = await served.context.sports.settlementFacts([fight.id]);
    const earlyMap = new Map(early.data.map((fact) => [fact.id, fact]));
    assert.equal(earlyMap.get(fight.id)?.status, 'UNKNOWN');

    const premature = await ledger.settle(earlyMap);
    assert.equal(premature[0]?.status, 'PENDING', 'a passed start time settles nothing');
    assert.equal((await ledger.findBet(placed.bet.id))?.status, 'OPEN');

    /* 9. The provider confirms: Fighter A won. */
    provider.setResults(UFC_LEAGUE.providerKey, [
      { providerEventId: fight.providerEventId, result: resultFor(fight, 'Fighter A', [0, 1]) },
    ]);
    served.context.cache.clear();

    const confirmed = await served.context.sports.settlementFacts([fight.id]);
    const confirmedMap = new Map(confirmed.data.map((fact) => [fact.id, fact]));
    assert.equal(confirmedMap.get(fight.id)?.status, 'FINAL');

    const outcomes = await ledger.settle(confirmedMap);
    assert.equal(outcomes[0]?.status, 'WON');
    assert.equal(outcomes[0]?.payoutCents, 16_667);

    /* 10. The bet reads WON, still at the price it was struck at. */
    const settled = await ledger.findBet(placed.bet.id);
    assert.equal(settled?.status, 'WON');
    assert.equal(settled?.payoutCents, 16_667);
    assert.equal(settled?.priceAmerican, -150, 'settled at the historical price, not -240');
    assert.ok(settled?.settledAt);

    /* 11. The balance is exactly right. */
    assert.equal((await ledger.wallet()).balanceCents, 1_006_667);
    assert.equal(formatCents((await ledger.wallet()).balanceCents), '$10,066.67');

    /* 12. The ledger reconciles to the cent. */
    const check = await ledger.reconcile();
    assert.ok(check.balanced);
    assert.equal(check.ledgerTotalCents, 1_006_667);
    assert.equal(check.entries, 3);

    /* 13. Re-running settlement changes nothing at all. */
    const before = (await ledger.wallet()).balanceCents;
    await ledger.settle(confirmedMap);
    await ledger.settle(confirmedMap);
    assert.equal((await ledger.wallet()).balanceCents, before, 'no second payout');
    assert.equal((await ledger.transactions()).filter((t) => t.type === 'BET_PAYOUT').length, 1);
    assert.ok((await ledger.reconcile()).balanced);
  } finally {
    await served.close();
  }
});

test('a provider outage leaves bets open and says so', async () => {
  const provider = new FakeProvider();
  const fight = buildEvent({
    providerEventId: 'ufc-outage',
    league: UFC_LEAGUE,
    competitors: ['Fighter N', 'Fighter M'],
    startTime: isoIn(3),
  });
  const market = moneylineMarket(fight, [110, -130]);
  provider.setLeagueEvents(UFC_LEAGUE.providerKey, [{ event: fight, markets: [market] }]);

  const served = await serve(provider);
  const ledger = createLedger();

  try {
    const pick = market.selections[1];
    assert.ok(pick);
    const placed = await ledger.place(
      {
        selections: [{ eventId: fight.id, marketKey: 'h2h', selectionId: pick.id, displayedPrice: -130 }],
        stakeCents: 10_000,
      },
      new Map([[fight.id, { event: fight, markets: [market] }]]),
    );
    assert.ok(placed.ok);
    if (!placed.ok) return;

    provider.failure = new ProviderError('NETWORK', 'provider unreachable');
    served.context.cache.clear();

    const facts = await served.context.sports.settlementFacts([fight.id]);
    assert.equal(facts.data.length, 0, 'nothing was invented to fill the gap');
    assert.equal(facts.freshness.source, 'unavailable');

    const outcomes = await ledger.settle(new Map(facts.data.map((fact) => [fact.id, fact])));
    assert.equal(outcomes.length, 0);
    assert.equal((await ledger.findBet(placed.bet.id))?.status, 'OPEN');
    assert.equal((await ledger.wallet()).balanceCents, 990_000);
    assert.ok((await ledger.reconcile()).balanced);
  } finally {
    await served.close();
  }
});

test('the feed degrades to an honest unavailable state', async () => {
  const provider = new FakeProvider();
  provider.failure = new ProviderError('NOT_CONFIGURED', 'no key');
  const served = await serve(provider);

  try {
    const feed = await getJson(served.base, '/api/feed');
    const data = feed['data'] as { totalEvents: number; headline: unknown };
    const freshness = feed['freshness'] as { source: string; error: string };

    assert.equal(data.totalEvents, 0, 'an empty hub, not a fabricated one');
    assert.equal(data.headline, null);
    assert.equal(freshness.source, 'unavailable');
    assert.equal(freshness.error, 'No sports data provider is configured.');
  } finally {
    await served.close();
  }
});
