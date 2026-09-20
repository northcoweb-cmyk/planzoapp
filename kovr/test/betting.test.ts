import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './support/harness.js';
import {
  UFC_LEAGUE,
  NFL_LEAGUE,
  buildEvent,
  isoIn,
  moneylineMarket,
  totalsMarket,
} from './support/fakeProvider.js';

function ufcCard() {
  const event = buildEvent({
    providerEventId: 'ufc-main-1',
    league: UFC_LEAGUE,
    competitors: ['Fighter B', 'Fighter A'],
    startTime: isoIn(6),
  });
  // Fighter A is the favourite at -150, Fighter B the underdog at +125.
  const market = moneylineMarket(event, [125, -150]);
  return { event, market };
}

test('placing a bet debits the wallet and opens the bet at the shown price', () => {
  const h = createHarness();
  try {
    const { event, market } = ufcCard();
    h.seed(UFC_LEAGUE, [{ event, markets: [market] }]);
    h.context.wallet.ensureDemoAccount();

    const favourite = market.selections[1];
    assert.ok(favourite);
    assert.equal(favourite.price, -150);

    const result = h.context.betting.place({
      selections: [
        { eventId: event.id, marketKey: 'h2h', selectionId: favourite.id, displayedPrice: -150 },
      ],
      stakeCents: 10_000,
    });

    assert.ok(result.ok, 'bet should be accepted');
    if (!result.ok) return;

    assert.equal(result.bet.status, 'OPEN');
    assert.equal(result.bet.stakeCents, 10_000);
    assert.equal(result.bet.priceAmerican, -150);
    assert.equal(result.bet.potentialPayoutCents, 16_667, '$100 at -150 returns $166.67');
    assert.equal(result.wallet.balanceCents, 990_000, 'balance fell by exactly the stake');

    assert.ok(h.context.wallet.reconcile().balanced);
  } finally {
    h.close();
  }
});

test('a price that moved between display and placement refuses the bet', () => {
  const h = createHarness();
  try {
    const { event, market } = ufcCard();
    h.seed(UFC_LEAGUE, [{ event, markets: [market] }]);
    h.context.wallet.ensureDemoAccount();
    const favourite = market.selections[1];
    assert.ok(favourite);

    // The market moves against the bettor before they tap Place Bet.
    h.context.repositories.events.saveMarkets(
      event.id,
      [moneylineMarket(event, [140, -175])],
      new Date().toISOString(),
    );

    const refused = h.context.betting.place({
      selections: [
        { eventId: event.id, marketKey: 'h2h', selectionId: favourite.id, displayedPrice: -150 },
      ],
      stakeCents: 10_000,
    });

    assert.ok(!refused.ok);
    if (refused.ok) return;
    assert.equal(refused.code, 'ODDS_CHANGED');
    assert.match(refused.message, /Odds changed from -150 to -175/);
    assert.equal(h.context.wallet.getWallet().balanceCents, 1_000_000, 'nothing was debited');
    assert.equal(h.context.betting.listBets().length, 0, 'no bet was created');

    if (refused.code !== 'ODDS_CHANGED') return;
    assert.equal(refused.changes[0]?.previousPrice, -150);
    assert.equal(refused.changes[0]?.currentPrice, -175);
    assert.equal(refused.changes[0]?.improved, false);
  } finally {
    h.close();
  }
});

test('accepting the new price places the bet at the new price, not the old one', () => {
  const h = createHarness();
  try {
    const { event, market } = ufcCard();
    h.seed(UFC_LEAGUE, [{ event, markets: [market] }]);
    h.context.wallet.ensureDemoAccount();
    const favourite = market.selections[1];
    assert.ok(favourite);

    h.context.repositories.events.saveMarkets(
      event.id,
      [moneylineMarket(event, [140, -175])],
      new Date().toISOString(),
    );

    const accepted = h.context.betting.place({
      selections: [
        { eventId: event.id, marketKey: 'h2h', selectionId: favourite.id, displayedPrice: -150 },
      ],
      stakeCents: 10_000,
      acceptCurrentOdds: true,
    });

    assert.ok(accepted.ok);
    if (!accepted.ok) return;
    assert.equal(accepted.bet.priceAmerican, -175, 'placed at the live price');
    assert.equal(accepted.bet.potentialPayoutCents, 15_714, '$100 at -175 returns $157.14');
  } finally {
    h.close();
  }
});

test('a placed bet keeps its price for ever, however far the market moves', () => {
  const h = createHarness();
  try {
    const { event, market } = ufcCard();
    h.seed(UFC_LEAGUE, [{ event, markets: [market] }]);
    h.context.wallet.ensureDemoAccount();
    const favourite = market.selections[1];
    assert.ok(favourite);

    const placed = h.context.betting.place({
      selections: [{ eventId: event.id, marketKey: 'h2h', selectionId: favourite.id, displayedPrice: -150 }],
      stakeCents: 10_000,
    });
    assert.ok(placed.ok);
    if (!placed.ok) return;

    // Five refreshes, each moving the line further.
    for (const price of [-160, -175, -210, 120, -400]) {
      h.context.repositories.events.saveMarkets(
        event.id,
        [moneylineMarket(event, [100, price])],
        new Date().toISOString(),
      );
    }

    const reloaded = h.context.betting.findBet(placed.bet.id);
    assert.ok(reloaded);
    assert.equal(reloaded.priceAmerican, -150, 'the bet still reads -150');
    assert.equal(reloaded.selections[0]?.priceAmerican, -150);
    assert.equal(reloaded.potentialPayoutCents, 16_667);

    // Meanwhile the live market really did move.
    const live = h.context.repositories.events.findCurrentPrice(event.id, 'h2h', favourite.id);
    assert.equal(live?.price, -400);

    // And every move was recorded.
    assert.ok(h.context.repositories.events.countSnapshots() >= 5, 'price history was appended');
  } finally {
    h.close();
  }
});

test('a stake larger than the balance is refused without touching the ledger', () => {
  const h = createHarness();
  try {
    const { event, market } = ufcCard();
    h.seed(UFC_LEAGUE, [{ event, markets: [market] }]);
    h.context.wallet.ensureDemoAccount();
    const favourite = market.selections[1];
    assert.ok(favourite);

    // Draw the balance down to $50, then try to stake $200.
    h.context.wallet.withdraw(995_000);
    const refused = h.context.betting.place({
      selections: [{ eventId: event.id, marketKey: 'h2h', selectionId: favourite.id, displayedPrice: -150 }],
      stakeCents: 20_000,
    });

    assert.ok(!refused.ok);
    if (refused.ok) return;
    assert.equal(refused.code, 'INSUFFICIENT_FUNDS');
    assert.equal(h.context.wallet.getWallet().balanceCents, 5_000, 'balance untouched by the refusal');
    assert.equal(h.context.wallet.listTransactions().length, 2, 'opening balance and the withdrawal only');
    assert.ok(h.context.wallet.reconcile().balanced);
  } finally {
    h.close();
  }
});

test('betting closes once an event has started or its status is unconfirmed', () => {
  const h = createHarness();
  try {
    const started = buildEvent({
      providerEventId: 'ufc-started',
      league: UFC_LEAGUE,
      competitors: ['Fighter D', 'Fighter C'],
      startTime: isoIn(-1),
      status: 'LIVE',
    });
    const market = moneylineMarket(started, [110, -130]);
    h.seed(UFC_LEAGUE, [{ event: started, markets: [market] }]);
    h.context.wallet.ensureDemoAccount();
    const pick = market.selections[0];
    assert.ok(pick);

    const live = h.context.betting.place({
      selections: [{ eventId: started.id, marketKey: 'h2h', selectionId: pick.id, displayedPrice: 110 }],
      stakeCents: 10_000,
    });
    assert.ok(!live.ok);
    if (!live.ok) assert.equal(live.code, 'EVENT_CLOSED');

    // An event whose status KOVR cannot confirm is also closed, deliberately.
    h.context.repositories.events.updateStatus(started.id, 'UNKNOWN', null, new Date().toISOString());
    const unknown = h.context.betting.place({
      selections: [{ eventId: started.id, marketKey: 'h2h', selectionId: pick.id, displayedPrice: 110 }],
      stakeCents: 10_000,
    });
    assert.ok(!unknown.ok);
    if (!unknown.ok) assert.equal(unknown.code, 'EVENT_CLOSED');
    assert.equal(h.context.wallet.getWallet().balanceCents, 1_000_000);
  } finally {
    h.close();
  }
});

test('an unknown event, market or selection is refused', () => {
  const h = createHarness();
  try {
    const { event, market } = ufcCard();
    h.seed(UFC_LEAGUE, [{ event, markets: [market] }]);
    h.context.wallet.ensureDemoAccount();
    const pick = market.selections[0];
    assert.ok(pick);

    const cases: Array<[string, { eventId: string; marketKey: string; selectionId: string }]> = [
      ['EVENT_NOT_FOUND', { eventId: 'evt_missing', marketKey: 'h2h', selectionId: pick.id }],
      ['MARKET_NOT_FOUND', { eventId: event.id, marketKey: 'player_pass_tds', selectionId: pick.id }],
      ['SELECTION_NOT_FOUND', { eventId: event.id, marketKey: 'h2h', selectionId: 'sel_missing' }],
    ];

    for (const [expected, selection] of cases) {
      const result = h.context.betting.place({
        selections: [{ ...selection, displayedPrice: 125 }],
        stakeCents: 10_000,
      });
      assert.ok(!result.ok, expected);
      if (!result.ok) assert.equal(result.code, expected);
    }
    assert.equal(h.context.wallet.getWallet().balanceCents, 1_000_000);
  } finally {
    h.close();
  }
});

test('a double-tapped Place Bet does not place the bet twice', () => {
  const h = createHarness();
  try {
    const { event, market } = ufcCard();
    h.seed(UFC_LEAGUE, [{ event, markets: [market] }]);
    h.context.wallet.ensureDemoAccount();
    const pick = market.selections[0];
    assert.ok(pick);

    const request = {
      selections: [{ eventId: event.id, marketKey: 'h2h', selectionId: pick.id, displayedPrice: 125 }],
      stakeCents: 10_000,
    };

    const first = h.context.betting.place(request);
    const second = h.context.betting.place(request);

    assert.ok(first.ok);
    assert.ok(!second.ok);
    if (!second.ok) assert.equal(second.code, 'DUPLICATE_BET');
    assert.equal(h.context.betting.listBets().length, 1);
    assert.equal(h.context.wallet.getWallet().balanceCents, 990_000, 'debited once');
  } finally {
    h.close();
  }
});

test('stake bounds are enforced', () => {
  const h = createHarness();
  try {
    const { event, market } = ufcCard();
    h.seed(UFC_LEAGUE, [{ event, markets: [market] }]);
    h.context.wallet.ensureDemoAccount();
    const pick = market.selections[0];
    assert.ok(pick);
    const leg = { eventId: event.id, marketKey: 'h2h', selectionId: pick.id, displayedPrice: 125 };

    for (const [stake, code] of [
      [0, 'INVALID_STAKE'],
      [-500, 'INVALID_STAKE'],
      [99, 'STAKE_TOO_SMALL'],
      [2_000_000, 'STAKE_TOO_LARGE'],
    ] as const) {
      const result = h.context.betting.place({ selections: [leg], stakeCents: stake });
      assert.ok(!result.ok, `stake ${stake}`);
      if (!result.ok) assert.equal(result.code, code);
    }
  } finally {
    h.close();
  }
});

test('a parlay prices from its legs and debits once', () => {
  const h = createHarness();
  try {
    const { event: fight, market: fightMarket } = ufcCard();
    const game = buildEvent({
      providerEventId: 'nfl-1',
      league: NFL_LEAGUE,
      competitors: ['Ravens', 'Chiefs'],
      startTime: isoIn(30),
    });
    const gameMarket = moneylineMarket(game, [-125, 105]);
    const total = totalsMarket(game, 47.5, [-110, -110]);

    h.seed(UFC_LEAGUE, [{ event: fight, markets: [fightMarket] }]);
    h.seed(NFL_LEAGUE, [{ event: game, markets: [gameMarket, total] }]);
    h.context.wallet.ensureDemoAccount();

    const legA = fightMarket.selections[1];
    const legB = gameMarket.selections[0];
    assert.ok(legA && legB);

    const result = h.context.betting.place({
      selections: [
        { eventId: fight.id, marketKey: 'h2h', selectionId: legA.id, displayedPrice: -150 },
        { eventId: game.id, marketKey: 'h2h', selectionId: legB.id, displayedPrice: -125 },
      ],
      stakeCents: 5_000,
    });

    assert.ok(result.ok);
    if (!result.ok) return;
    // -150 -> 1.6667, -125 -> 1.8 ; 1.6667 x 1.8 = 3.0 -> +200
    assert.equal(result.bet.priceAmerican, 200);
    assert.equal(result.bet.potentialPayoutCents, 15_000, '$50 at +200 returns $150');
    assert.equal(result.bet.selections.length, 2);
    assert.equal(result.wallet.balanceCents, 995_000);
  } finally {
    h.close();
  }
});
