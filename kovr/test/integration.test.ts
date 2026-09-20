/**
 * The end-to-end path the specification calls out as critical:
 *
 *   $10,000 -> pick a UFC fighter -> place $100 -> balance falls -> bet OPEN
 *   -> the market moves -> the placed bet keeps its price -> the fight is
 *   confirmed final -> the winner is confirmed -> the bet settles -> the
 *   correct payout lands -> activity updates -> the wallet reconciles.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './support/harness.js';
import { UFC_LEAGUE, buildEvent, isoIn, moneylineMarket, resultFor } from './support/fakeProvider.js';
import { formatAmericanOdds } from '../src/core/odds.js';
import { formatCents } from '../src/core/money.js';

test('UFC: full lifecycle from an empty account to a reconciled payout', async () => {
  const h = createHarness();
  try {
    /* 1. A new demo account opens at $10,000.00, entirely from the ledger. */
    const opening = h.context.wallet.ensureDemoAccount();
    assert.equal(opening.wallet.balanceCents, 1_000_000);
    assert.equal(formatCents(opening.wallet.balanceCents), '$10,000.00');

    /* 2. A real-shaped UFC card is synced in from the provider. */
    const fight = buildEvent({
      providerEventId: 'ufc-312-main',
      league: UFC_LEAGUE,
      competitors: ['Fighter B', 'Fighter A'],
      startTime: isoIn(5),
    });
    h.provider.setLeagueEvents(UFC_LEAGUE.providerKey, [
      { event: fight, markets: [moneylineMarket(fight, [125, -150])] },
    ]);
    h.seed(UFC_LEAGUE, [{ event: fight, markets: [moneylineMarket(fight, [125, -150])] }]);

    await h.context.sports.syncCatalog({ force: true });
    const synced = await h.context.sports.syncLeague('ufc', { force: true });
    assert.equal(synced.source, 'live');
    assert.equal(synced.events, 1);

    /* 3. The fighter shows at -150 in the market the UI would render. */
    const view = h.context.sports.getEvent(fight.id);
    const moneyline = view.data?.markets.find((market) => market.key === 'h2h');
    const fighterA = moneyline?.selections.find((selection) => selection.name === 'Fighter A');
    assert.ok(fighterA);
    assert.equal(fighterA.price, -150);
    assert.equal(formatAmericanOdds(fighterA.price), '-150');

    /* 4. $100 is staked on Fighter A at the displayed price. */
    const placed = h.context.betting.place({
      selections: [{ eventId: fight.id, marketKey: 'h2h', selectionId: fighterA.id, displayedPrice: -150 }],
      stakeCents: 10_000,
    });
    assert.ok(placed.ok);
    if (!placed.ok) return;

    /* 5. The balance falls by exactly the stake and the bet is OPEN. */
    assert.equal(placed.wallet.balanceCents, 990_000);
    assert.equal(placed.bet.status, 'OPEN');
    assert.equal(placed.bet.potentialPayoutCents, 16_667);
    assert.equal(formatCents(placed.bet.potentialPayoutCents), '$166.67');
    assert.equal(h.context.betting.listBets(['OPEN']).length, 1);

    /* 6. The market moves. Twice, and hard. */
    h.context.repositories.events.saveMarkets(
      fight.id,
      [moneylineMarket(fight, [140, -175])],
      new Date().toISOString(),
    );
    h.context.repositories.events.saveMarkets(
      fight.id,
      [moneylineMarket(fight, [180, -240])],
      new Date().toISOString(),
    );

    const moved = h.context.repositories.events.findCurrentPrice(fight.id, 'h2h', fighterA.id);
    assert.equal(moved?.price, -240, 'the live market really did move');

    /* 7. The placed bet is untouched by any of it. */
    const held = h.context.betting.findBet(placed.bet.id);
    assert.equal(held?.priceAmerican, -150);
    assert.equal(held?.selections[0]?.priceAmerican, -150);
    assert.equal(held?.potentialPayoutCents, 16_667);
    assert.equal(held?.status, 'OPEN');

    /* 8. The fight ends. Before a confirmed result, nothing settles. */
    h.context.database.run(
      "UPDATE events SET start_time = ?, status = 'UNKNOWN' WHERE id = ?",
      isoIn(-2),
      fight.id,
    );
    const premature = await h.context.settlement.sweep();
    assert.equal(premature.betsSettled, 0, 'a passed start time settles nothing');
    assert.equal(premature.betsPending, 1);
    assert.equal(h.context.betting.findBet(placed.bet.id)?.status, 'OPEN');

    /* 9. The provider confirms the result: Fighter A won. */
    h.provider.setResults(UFC_LEAGUE.providerKey, [
      { providerEventId: fight.providerEventId, result: resultFor(fight, 'Fighter A', [0, 1]) },
    ]);

    const sweep = await h.context.settlement.sweep();
    assert.equal(sweep.resultsRecorded, 1);
    assert.equal(sweep.betsSettled, 1);
    assert.deepEqual(sweep.errors, []);

    /* 10. The bet reads WON, still at the price it was struck at. */
    const settled = h.context.betting.findBet(placed.bet.id);
    assert.equal(settled?.status, 'WON');
    assert.equal(settled?.payoutCents, 16_667);
    assert.equal(settled?.priceAmerican, -150, 'settled at the historical price, not -240');
    assert.ok(settled?.settledAt);

    /* 11. The wallet holds exactly the right amount. */
    assert.equal(h.context.wallet.getWallet().balanceCents, 1_006_667);
    assert.equal(formatCents(h.context.wallet.getWallet().balanceCents), '$10,066.67');

    /* 12. Activity tells the story in order. */
    const activity = h.context.activity.list();
    assert.deepEqual(
      activity.map((item) => item.kind),
      ['PAYOUT', 'BET', 'SYSTEM'],
      'newest first: payout, the bet, the opening balance',
    );
    assert.equal(activity[0]?.amountCents, 16_667);
    assert.equal(activity[0]?.status, '+$166.67');
    assert.equal(activity[1]?.amountCents, -10_000);

    /* 13. The ledger reconciles against the balance, to the cent. */
    const check = h.context.wallet.reconcile();
    assert.ok(check.balanced, 'ledger and balance agree');
    assert.equal(check.ledgerTotalCents, 1_006_667);
    assert.equal(check.entries, 3);

    /* 14. Re-running settlement changes nothing at all. */
    const before = h.context.wallet.getWallet().balanceCents;
    await h.context.settlement.sweep();
    await h.context.settlement.sweep();
    h.context.settlement.settleEvent(fight.id);
    assert.equal(h.context.wallet.getWallet().balanceCents, before, 'no second payout');
    assert.equal(
      h.context.wallet.listTransactions().filter((t) => t.type === 'BET_PAYOUT').length,
      1,
    );
    assert.ok(h.context.wallet.reconcile().balanced);
  } finally {
    h.close();
  }
});

test('the same lifecycle with a loss leaves the books straight', async () => {
  const h = createHarness();
  try {
    h.context.wallet.ensureDemoAccount();
    const fight = buildEvent({
      providerEventId: 'ufc-312-co',
      league: UFC_LEAGUE,
      competitors: ['Fighter L', 'Fighter K'],
      startTime: isoIn(4),
    });
    const market = moneylineMarket(fight, [200, -250]);
    h.seed(UFC_LEAGUE, [{ event: fight, markets: [market] }]);

    const underdog = market.selections[0];
    assert.ok(underdog);
    const placed = h.context.betting.place({
      selections: [{ eventId: fight.id, marketKey: 'h2h', selectionId: underdog.id, displayedPrice: 200 }],
      stakeCents: 25_000,
    });
    assert.ok(placed.ok);
    if (!placed.ok) return;
    assert.equal(placed.bet.potentialPayoutCents, 75_000, '$250 at +200 returns $750');

    h.context.database.run("UPDATE events SET start_time = ? WHERE id = ?", isoIn(-3), fight.id);
    h.provider.setResults(UFC_LEAGUE.providerKey, [
      { providerEventId: fight.providerEventId, result: resultFor(fight, 'Fighter K', [0, 1]) },
    ]);

    await h.context.settlement.sweep();

    assert.equal(h.context.betting.findBet(placed.bet.id)?.status, 'LOST');
    assert.equal(h.context.wallet.getWallet().balanceCents, 975_000);
    const check = h.context.wallet.reconcile();
    assert.ok(check.balanced);
    assert.equal(check.ledgerTotalCents, 975_000);
  } finally {
    h.close();
  }
});

test('a provider outage during settlement leaves bets open and reports why', async () => {
  const h = createHarness();
  try {
    h.context.wallet.ensureDemoAccount();
    const fight = buildEvent({
      providerEventId: 'ufc-outage-settle',
      league: UFC_LEAGUE,
      competitors: ['Fighter N', 'Fighter M'],
      startTime: isoIn(3),
    });
    const market = moneylineMarket(fight, [110, -130]);
    h.seed(UFC_LEAGUE, [{ event: fight, markets: [market] }]);

    const pick = market.selections[1];
    assert.ok(pick);
    const placed = h.context.betting.place({
      selections: [{ eventId: fight.id, marketKey: 'h2h', selectionId: pick.id, displayedPrice: -130 }],
      stakeCents: 10_000,
    });
    assert.ok(placed.ok);
    if (!placed.ok) return;

    h.context.database.run("UPDATE events SET start_time = ? WHERE id = ?", isoIn(-2), fight.id);

    const { ProviderError } = await import('../src/providers/SportsDataProvider.js');
    h.provider.failure = new ProviderError('NETWORK', 'provider unreachable');

    const report = await h.context.settlement.sweep();
    assert.equal(report.resultsRecorded, 0);
    assert.equal(report.betsSettled, 0);
    assert.equal(report.betsPending, 1);
    assert.equal(report.errors.length, 1);
    assert.match(report.errors[0] ?? '', /could not be reached/);

    assert.equal(h.context.betting.findBet(placed.bet.id)?.status, 'OPEN');
    assert.equal(h.context.wallet.getWallet().balanceCents, 990_000);
    assert.ok(h.context.wallet.reconcile().balanced);
  } finally {
    h.close();
  }
});
