import test from 'node:test';
import assert from 'node:assert/strict';
import { createLedger, liveMap } from './support/ledgerHarness.js';
import { UFC_LEAGUE, NFL_LEAGUE, buildEvent, isoIn, moneylineMarket, totalsMarket } from './support/fakeProvider.js';

function ufcCard() {
  const event = buildEvent({
    providerEventId: 'ufc-main-1',
    league: UFC_LEAGUE,
    competitors: ['Fighter B', 'Fighter A'],
    startTime: isoIn(6),
  });
  // Fighter A is the favourite at -150, Fighter B the underdog at +125.
  return { event, market: moneylineMarket(event, [125, -150]) };
}

test('placing a bet debits the balance and opens the bet at the shown price', async () => {
  const ledger = createLedger();
  const { event, market } = ufcCard();
  const favourite = market.selections[1];
  assert.ok(favourite);
  assert.equal(favourite.price, -150);

  const result = await ledger.place(
    {
      selections: [{ eventId: event.id, marketKey: 'h2h', selectionId: favourite.id, displayedPrice: -150 }],
      stakeCents: 10_000,
    },
    liveMap({ event, markets: [market] }),
  );

  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(result.bet.status, 'OPEN');
  assert.equal(result.bet.priceAmerican, -150);
  assert.equal(result.bet.potentialPayoutCents, 16_667, '$100 at -150 returns $166.67');
  assert.equal(result.wallet.balanceCents, 990_000);
  assert.ok((await ledger.reconcile()).balanced);
});

test('a price that moved between display and placement refuses the bet', async () => {
  const ledger = createLedger();
  const { event, market } = ufcCard();
  const favourite = market.selections[1];
  assert.ok(favourite);

  const moved = moneylineMarket(event, [140, -175]);
  const refused = await ledger.place(
    {
      selections: [{ eventId: event.id, marketKey: 'h2h', selectionId: favourite.id, displayedPrice: -150 }],
      stakeCents: 10_000,
    },
    liveMap({ event, markets: [moved] }),
  );

  assert.ok(!refused.ok);
  if (refused.ok) return;
  assert.equal(refused.code, 'ODDS_CHANGED');
  assert.match(refused.message, /Odds changed from -150 to -175/);
  assert.equal((await ledger.wallet()).balanceCents, 1_000_000, 'nothing was debited');
  assert.equal((await ledger.bets()).length, 0, 'no bet was created');

  if (refused.code !== 'ODDS_CHANGED') return;
  assert.equal(refused.changes[0]?.previousPrice, -150);
  assert.equal(refused.changes[0]?.currentPrice, -175);
  assert.equal(refused.changes[0]?.improved, false);
  assert.equal(refused.changes[0]?.selectionId, favourite.id, 'identified by id, not by name');
});

test('accepting the new price places at the new price, not the old one', async () => {
  const ledger = createLedger();
  const { event, market } = ufcCard();
  const favourite = market.selections[1];
  assert.ok(favourite);

  const accepted = await ledger.place(
    {
      selections: [{ eventId: event.id, marketKey: 'h2h', selectionId: favourite.id, displayedPrice: -150 }],
      stakeCents: 10_000,
      acceptCurrentOdds: true,
    },
    liveMap({ event, markets: [moneylineMarket(event, [140, -175])] }),
  );

  assert.ok(accepted.ok);
  if (!accepted.ok) return;
  assert.equal(accepted.bet.priceAmerican, -175);
  assert.equal(accepted.bet.potentialPayoutCents, 15_714, '$100 at -175 returns $157.14');
});

test('a placed bet keeps its price however far the market moves', async () => {
  const ledger = createLedger();
  const { event, market } = ufcCard();
  const favourite = market.selections[1];
  assert.ok(favourite);

  const placed = await ledger.place(
    {
      selections: [{ eventId: event.id, marketKey: 'h2h', selectionId: favourite.id, displayedPrice: -150 }],
      stakeCents: 10_000,
    },
    liveMap({ event, markets: [market] }),
  );
  assert.ok(placed.ok);
  if (!placed.ok) return;

  // Five refreshes, each moving the line further. The ledger never sees a
  // reason to touch the stored bet, because nothing writes to it.
  for (const price of [-160, -175, -210, 120, -400]) {
    await ledger.place(
      {
        selections: [{ eventId: event.id, marketKey: 'h2h', selectionId: favourite.id, displayedPrice: price }],
        stakeCents: 100,
      },
      liveMap({ event, markets: [moneylineMarket(event, [100, price])] }),
    );
  }

  const reloaded = await ledger.findBet(placed.bet.id);
  assert.ok(reloaded);
  assert.equal(reloaded.priceAmerican, -150, 'the bet still reads -150');
  assert.equal(reloaded.selections[0]?.priceAmerican, -150);
  assert.equal(reloaded.potentialPayoutCents, 16_667);
});

test('a stake larger than the balance is refused without touching the ledger', async () => {
  const ledger = createLedger();
  const { event, market } = ufcCard();
  const favourite = market.selections[1];
  assert.ok(favourite);

  await ledger.withdraw(995_000);
  const refused = await ledger.place(
    {
      selections: [{ eventId: event.id, marketKey: 'h2h', selectionId: favourite.id, displayedPrice: -150 }],
      stakeCents: 20_000,
    },
    liveMap({ event, markets: [market] }),
  );

  assert.ok(!refused.ok);
  if (refused.ok) return;
  assert.equal(refused.code, 'INSUFFICIENT_FUNDS');
  assert.equal((await ledger.wallet()).balanceCents, 5_000);
  assert.equal((await ledger.transactions()).length, 2);
  assert.ok((await ledger.reconcile()).balanced);
});

test('betting closes once an event has started or its status is unconfirmed', async () => {
  const ledger = createLedger();
  const started = buildEvent({
    providerEventId: 'ufc-started',
    league: UFC_LEAGUE,
    competitors: ['Fighter D', 'Fighter C'],
    startTime: isoIn(-1),
    status: 'LIVE',
  });
  const market = moneylineMarket(started, [110, -130]);
  const pick = market.selections[0];
  assert.ok(pick);
  const leg = { eventId: started.id, marketKey: 'h2h', selectionId: pick.id, displayedPrice: 110 };

  const live = await ledger.place({ selections: [leg], stakeCents: 10_000 }, liveMap({ event: started, markets: [market] }));
  assert.ok(!live.ok);
  if (!live.ok) assert.equal(live.code, 'EVENT_CLOSED');

  const unknown = await ledger.place(
    { selections: [leg], stakeCents: 10_000 },
    liveMap({ event: { ...started, status: 'UNKNOWN' }, markets: [market] }),
  );
  assert.ok(!unknown.ok);
  if (!unknown.ok) assert.equal(unknown.code, 'EVENT_CLOSED');

  // Even an UPCOMING status cannot outrank the clock.
  const stale = await ledger.place(
    { selections: [leg], stakeCents: 10_000 },
    liveMap({ event: { ...started, status: 'UPCOMING' }, markets: [market] }),
  );
  assert.ok(!stale.ok);
  if (!stale.ok) assert.equal(stale.code, 'EVENT_STARTED');

  assert.equal((await ledger.wallet()).balanceCents, 1_000_000);
});

test('an unknown event, market or selection is refused', async () => {
  const ledger = createLedger();
  const { event, market } = ufcCard();
  const pick = market.selections[0];
  assert.ok(pick);
  const live = liveMap({ event, markets: [market] });

  const cases: Array<[string, { eventId: string; marketKey: string; selectionId: string }]> = [
    ['EVENT_NOT_FOUND', { eventId: 'evt_missing', marketKey: 'h2h', selectionId: pick.id }],
    ['MARKET_NOT_FOUND', { eventId: event.id, marketKey: 'player_pass_tds', selectionId: pick.id }],
    ['SELECTION_NOT_FOUND', { eventId: event.id, marketKey: 'h2h', selectionId: 'sel_missing' }],
  ];

  for (const [expected, selection] of cases) {
    const result = await ledger.place({ selections: [{ ...selection, displayedPrice: 125 }], stakeCents: 10_000 }, live);
    assert.ok(!result.ok, expected);
    if (!result.ok) assert.equal(result.code, expected);
  }
  assert.equal((await ledger.wallet()).balanceCents, 1_000_000);
});

test('a double-tapped Place Bet does not place the bet twice', async () => {
  const ledger = createLedger();
  const { event, market } = ufcCard();
  const pick = market.selections[0];
  assert.ok(pick);
  const live = liveMap({ event, markets: [market] });
  const request = {
    selections: [{ eventId: event.id, marketKey: 'h2h', selectionId: pick.id, displayedPrice: 125 }],
    stakeCents: 10_000,
  };

  const first = await ledger.place(request, live);
  const second = await ledger.place(request, live);

  assert.ok(first.ok);
  assert.ok(!second.ok);
  if (!second.ok) assert.equal(second.code, 'DUPLICATE_BET');
  assert.equal((await ledger.bets()).length, 1);
  assert.equal((await ledger.wallet()).balanceCents, 990_000, 'debited once');
});

test('stake bounds are enforced', async () => {
  const ledger = createLedger();
  const { event, market } = ufcCard();
  const pick = market.selections[0];
  assert.ok(pick);
  const live = liveMap({ event, markets: [market] });
  const leg = { eventId: event.id, marketKey: 'h2h', selectionId: pick.id, displayedPrice: 125 };

  for (const [stake, code] of [
    [0, 'INVALID_STAKE'],
    [-500, 'INVALID_STAKE'],
    [99, 'STAKE_TOO_SMALL'],
    [2_000_000, 'STAKE_TOO_LARGE'],
  ] as const) {
    const result = await ledger.place({ selections: [leg], stakeCents: stake }, live);
    assert.ok(!result.ok, `stake ${stake}`);
    if (!result.ok) assert.equal(result.code, code);
  }
});

test('a parlay prices from its legs and debits once', async () => {
  const ledger = createLedger();
  const { event: fight, market: fightMarket } = ufcCard();
  const game = buildEvent({
    providerEventId: 'nfl-1',
    league: NFL_LEAGUE,
    competitors: ['Ravens', 'Chiefs'],
    startTime: isoIn(30),
  });
  const gameMarket = moneylineMarket(game, [-125, 105]);
  const total = totalsMarket(game, 47.5, [-110, -110]);

  const legA = fightMarket.selections[1];
  const legB = gameMarket.selections[0];
  assert.ok(legA && legB);

  const result = await ledger.place(
    {
      selections: [
        { eventId: fight.id, marketKey: 'h2h', selectionId: legA.id, displayedPrice: -150 },
        { eventId: game.id, marketKey: 'h2h', selectionId: legB.id, displayedPrice: -125 },
      ],
      stakeCents: 5_000,
    },
    liveMap({ event: fight, markets: [fightMarket] }, { event: game, markets: [gameMarket, total] }),
  );

  assert.ok(result.ok);
  if (!result.ok) return;
  // -150 -> 1.6667, -125 -> 1.8 ; 1.6667 x 1.8 = 3.0 -> +200
  assert.equal(result.bet.priceAmerican, 200);
  assert.equal(result.bet.potentialPayoutCents, 15_000, '$50 at +200 returns $150');
  assert.equal(result.bet.selections.length, 2);
  assert.equal(result.wallet.balanceCents, 995_000);
});
