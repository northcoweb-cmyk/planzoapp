import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './support/harness.js';
import {
  UFC_LEAGUE,
  NFL_LEAGUE,
  buildEvent,
  isoIn,
  moneylineMarket,
  resultFor,
  spreadMarket,
  totalsMarket,
} from './support/fakeProvider.js';
import type { Harness } from './support/harness.js';

function seedFight(h: Harness) {
  const event = buildEvent({
    providerEventId: 'ufc-settle-1',
    league: UFC_LEAGUE,
    competitors: ['Fighter B', 'Fighter A'],
    startTime: isoIn(2),
  });
  const market = moneylineMarket(event, [125, -150]);
  h.seed(UFC_LEAGUE, [{ event, markets: [market] }]);
  h.context.wallet.ensureDemoAccount();
  return { event, market };
}

function backFighterA(h: Harness, event: ReturnType<typeof seedFight>['event'], market: ReturnType<typeof seedFight>['market']) {
  const favourite = market.selections[1];
  assert.ok(favourite);
  const placed = h.context.betting.place({
    selections: [{ eventId: event.id, marketKey: 'h2h', selectionId: favourite.id, displayedPrice: -150 }],
    stakeCents: 10_000,
  });
  assert.ok(placed.ok);
  if (!placed.ok) throw new Error('bet rejected');
  return placed.bet;
}

test('a UFC winner pays the exact calculated amount', () => {
  const h = createHarness();
  try {
    const { event, market } = seedFight(h);
    const bet = backFighterA(h, event, market);

    h.context.repositories.events.recordResult(
      event.id,
      resultFor(event, 'Fighter A', [0, 1]),
      new Date().toISOString(),
    );

    const [outcome] = h.context.settlement.settleEvent(event.id);
    assert.equal(outcome?.status, 'WON');
    assert.equal(outcome?.payoutCents, 16_667);

    const settled = h.context.betting.findBet(bet.id);
    assert.equal(settled?.status, 'WON');
    assert.equal(settled?.payoutCents, 16_667);
    assert.equal(settled?.priceAmerican, -150, 'the graded price is still the placed price');

    // $10,000 - $100 stake + $166.67 returned
    assert.equal(h.context.wallet.getWallet().balanceCents, 1_006_667);
    assert.ok(h.context.wallet.reconcile().balanced);

    const payout = h.context.wallet.listTransactions().find((t) => t.type === 'BET_PAYOUT');
    assert.equal(payout?.amountCents, 16_667);
    assert.equal(payout?.betId, bet.id);
  } finally {
    h.close();
  }
});

test('a losing bet pays nothing and leaves the stake gone', () => {
  const h = createHarness();
  try {
    const { event, market } = seedFight(h);
    const bet = backFighterA(h, event, market);

    h.context.repositories.events.recordResult(
      event.id,
      resultFor(event, 'Fighter B', [1, 0]),
      new Date().toISOString(),
    );
    h.context.settlement.settleEvent(event.id);

    const settled = h.context.betting.findBet(bet.id);
    assert.equal(settled?.status, 'LOST');
    assert.equal(settled?.payoutCents, 0);
    assert.equal(h.context.wallet.getWallet().balanceCents, 990_000);
    assert.equal(
      h.context.wallet.listTransactions().filter((t) => t.type === 'BET_PAYOUT').length,
      0,
      'no payout row was written',
    );
    assert.ok(h.context.wallet.reconcile().balanced);
  } finally {
    h.close();
  }
});

test('nothing settles merely because the start time has passed', () => {
  const h = createHarness();
  try {
    const event = buildEvent({
      providerEventId: 'ufc-no-result',
      league: UFC_LEAGUE,
      competitors: ['Fighter F', 'Fighter E'],
      startTime: isoIn(-4),
      status: 'UPCOMING',
    });
    const market = moneylineMarket(event, [120, -140]);
    h.seed(UFC_LEAGUE, [{ event, markets: [market] }]);
    h.context.wallet.ensureDemoAccount();

    // Place while it was still open, then let the clock run past the start.
    h.context.repositories.events.updateStatus(event.id, 'UPCOMING', null, new Date().toISOString());
    const pick = market.selections[1];
    assert.ok(pick);
    h.context.repositories.bets.create(
      {
        userId: 'demo-user',
        walletId: h.context.wallet.getWallet().id,
        stakeCents: 10_000,
        priceAmerican: -140,
        potentialPayoutCents: 17_143,
        selections: [
          {
            eventId: event.id,
            providerEventId: event.providerEventId,
            leagueId: event.leagueId,
            eventName: event.name,
            eventStartTime: event.startTime,
            marketKey: 'h2h',
            marketName: 'Moneyline',
            selectionId: pick.id,
            selectionName: pick.name,
            participantExternalId: pick.participantExternalId,
            line: null,
            priceAmerican: -140,
            bookmakerKey: 'kovr_test_book',
            marketOffersDraw: false,
          },
        ],
      },
      new Date().toISOString(),
    );

    // Hours after the scheduled start, with no confirmed result on file.
    const outcomes = h.context.settlement.settleEvent(event.id);
    assert.equal(outcomes[0]?.status, 'PENDING');
    assert.equal(h.context.betting.listBets(['OPEN']).length, 1, 'the bet is still open');
    assert.equal(h.context.wallet.listTransactions().filter((t) => t.type === 'BET_PAYOUT').length, 0);
  } finally {
    h.close();
  }
});

test('settling twice never pays twice', () => {
  const h = createHarness();
  try {
    const { event, market } = seedFight(h);
    const bet = backFighterA(h, event, market);
    h.context.repositories.events.recordResult(
      event.id,
      resultFor(event, 'Fighter A', [0, 1]),
      new Date().toISOString(),
    );

    // Ten sweeps, as if a scheduler fired repeatedly.
    for (let i = 0; i < 10; i++) h.context.settlement.settleEvent(event.id);
    // And a direct re-settle of the same bet object.
    const stale = { ...bet, status: 'OPEN' as const };
    h.context.settlement.settleBet(stale);

    assert.equal(h.context.wallet.getWallet().balanceCents, 1_006_667, 'credited exactly once');
    assert.equal(
      h.context.wallet.listTransactions().filter((t) => t.type === 'BET_PAYOUT').length,
      1,
      'one payout row only',
    );
    assert.ok(h.context.wallet.reconcile().balanced);
  } finally {
    h.close();
  }
});

test('a cancelled event voids its bets and returns the stake', () => {
  const h = createHarness();
  try {
    const { event, market } = seedFight(h);
    const bet = backFighterA(h, event, market);

    h.context.database.run("UPDATE events SET status = 'CANCELLED' WHERE id = ?", event.id);
    h.context.settlement.settleEvent(event.id);

    const settled = h.context.betting.findBet(bet.id);
    assert.equal(settled?.status, 'VOID');
    assert.equal(settled?.payoutCents, 10_000);
    assert.equal(h.context.wallet.getWallet().balanceCents, 1_000_000, 'back where it started');

    const refund = h.context.wallet.listTransactions().find((t) => t.type === 'BET_REFUND');
    assert.equal(refund?.amountCents, 10_000);
    assert.ok(h.context.wallet.reconcile().balanced);
  } finally {
    h.close();
  }
});

test('a drawn two-way moneyline pushes and returns the stake', () => {
  const h = createHarness();
  try {
    const { event, market } = seedFight(h);
    const bet = backFighterA(h, event, market);

    h.context.repositories.events.recordResult(
      event.id,
      resultFor(event, null, [1, 1]),
      new Date().toISOString(),
    );
    h.context.settlement.settleEvent(event.id);

    const settled = h.context.betting.findBet(bet.id);
    assert.equal(settled?.status, 'PUSH');
    assert.equal(settled?.payoutCents, 10_000);
    assert.equal(h.context.wallet.getWallet().balanceCents, 1_000_000);
    assert.ok(h.context.wallet.reconcile().balanced);
  } finally {
    h.close();
  }
});

test('a spread landing exactly on the number pushes', () => {
  const h = createHarness();
  try {
    const game = buildEvent({
      providerEventId: 'nfl-spread',
      league: NFL_LEAGUE,
      competitors: ['Ravens', 'Chiefs'],
      startTime: isoIn(3),
    });
    // Ravens +3, Chiefs -3
    const spread = spreadMarket(game, [3, -3], [-110, -110]);
    h.seed(NFL_LEAGUE, [{ event: game, markets: [spread] }]);
    h.context.wallet.ensureDemoAccount();

    const chiefs = spread.selections[1];
    assert.ok(chiefs);
    const placed = h.context.betting.place({
      selections: [{ eventId: game.id, marketKey: 'spreads', selectionId: chiefs.id, displayedPrice: -110 }],
      stakeCents: 10_000,
    });
    assert.ok(placed.ok);
    if (!placed.ok) return;

    // Chiefs win 24-21: a three-point margin against a -3 line is a push.
    h.context.repositories.events.recordResult(
      game.id,
      resultFor(game, 'Chiefs', [21, 24]),
      new Date().toISOString(),
    );
    h.context.settlement.settleEvent(game.id);

    const settled = h.context.betting.findBet(placed.bet.id);
    assert.equal(settled?.status, 'PUSH');
    assert.equal(settled?.payoutCents, 10_000);
    assert.equal(h.context.wallet.getWallet().balanceCents, 1_000_000);
  } finally {
    h.close();
  }
});

test('totals grade over, under and the exact number', () => {
  const h = createHarness();
  try {
    h.context.wallet.ensureDemoAccount();

    const cases: Array<[number, [number, number], 'WON' | 'LOST' | 'PUSH', 'Over' | 'Under']> = [
      [47.5, [24, 27], 'WON', 'Over'],
      [47.5, [10, 13], 'LOST', 'Over'],
      [47.5, [10, 13], 'WON', 'Under'],
      [48, [24, 24], 'PUSH', 'Over'],
      [48, [24, 24], 'PUSH', 'Under'],
    ];

    for (const [index, [line, scores, expected, side]] of cases.entries()) {
      const game = buildEvent({
        providerEventId: `nfl-total-${index}`,
        league: NFL_LEAGUE,
        competitors: [`Away${index}`, `Home${index}`],
        startTime: isoIn(4),
      });
      const total = totalsMarket(game, line, [-110, -110]);
      h.seed(NFL_LEAGUE, [{ event: game, markets: [total] }]);

      const selection = total.selections.find((s) => s.name === side);
      assert.ok(selection);
      const placed = h.context.betting.place({
        selections: [{ eventId: game.id, marketKey: 'totals', selectionId: selection.id, displayedPrice: -110 }],
        stakeCents: 1_000,
      });
      assert.ok(placed.ok, `${side} ${line}`);
      if (!placed.ok) continue;

      h.context.repositories.events.recordResult(
        game.id,
        resultFor(game, scores[1] > scores[0] ? `Home${index}` : `Away${index}`, scores),
        new Date().toISOString(),
      );
      h.context.settlement.settleEvent(game.id);

      const settled = h.context.betting.findBet(placed.bet.id);
      assert.equal(settled?.status, expected, `${side} ${line} with ${scores.join('-')}`);
    }

    assert.ok(h.context.wallet.reconcile().balanced);
  } finally {
    h.close();
  }
});

test('a market KOVR cannot grade leaves the bet open rather than guessing', () => {
  const h = createHarness();
  try {
    const game = buildEvent({
      providerEventId: 'nfl-prop',
      league: NFL_LEAGUE,
      competitors: ['Away', 'Home'],
      startTime: isoIn(5),
    });
    const prop = {
      key: 'player_pass_tds',
      name: 'Player Pass Tds',
      kind: 'PLAYER_PROP' as const,
      lastUpdatedAt: new Date().toISOString(),
      selections: [
        {
          id: 'sel_prop_over',
          name: 'Over 1.5',
          participantExternalId: null,
          line: 1.5,
          price: -120,
          bookmakerKey: 'kovr_test_book',
          bookmakerName: 'Test Book',
          priceUpdatedAt: new Date().toISOString(),
        },
      ],
    };
    h.seed(NFL_LEAGUE, [{ event: game, markets: [prop] }]);
    h.context.wallet.ensureDemoAccount();

    const placed = h.context.betting.place({
      selections: [
        { eventId: game.id, marketKey: 'player_pass_tds', selectionId: 'sel_prop_over', displayedPrice: -120 },
      ],
      stakeCents: 2_000,
    });
    assert.ok(placed.ok);
    if (!placed.ok) return;

    h.context.repositories.events.recordResult(
      game.id,
      resultFor(game, 'Home', [17, 27]),
      new Date().toISOString(),
    );
    const outcomes = h.context.settlement.settleEvent(game.id);

    assert.equal(outcomes[0]?.status, 'PENDING');
    assert.equal(h.context.betting.findBet(placed.bet.id)?.status, 'OPEN');
    assert.equal(h.context.wallet.listTransactions().filter((t) => t.type === 'BET_PAYOUT').length, 0);
  } finally {
    h.close();
  }
});

test('a parlay with one pushed leg reprices on the surviving legs', () => {
  const h = createHarness();
  try {
    const fight = buildEvent({
      providerEventId: 'ufc-parlay',
      league: UFC_LEAGUE,
      competitors: ['Fighter H', 'Fighter G'],
      startTime: isoIn(6),
    });
    const fightMarket = moneylineMarket(fight, [130, -150]);

    const game = buildEvent({
      providerEventId: 'nfl-parlay',
      league: NFL_LEAGUE,
      competitors: ['Away', 'Home'],
      startTime: isoIn(7),
    });
    const spread = spreadMarket(game, [3, -3], [-110, -110]);

    h.seed(UFC_LEAGUE, [{ event: fight, markets: [fightMarket] }]);
    h.seed(NFL_LEAGUE, [{ event: game, markets: [spread] }]);
    h.context.wallet.ensureDemoAccount();

    const winner = fightMarket.selections[1];
    const pushLeg = spread.selections[1];
    assert.ok(winner && pushLeg);

    const placed = h.context.betting.place({
      selections: [
        { eventId: fight.id, marketKey: 'h2h', selectionId: winner.id, displayedPrice: -150 },
        { eventId: game.id, marketKey: 'spreads', selectionId: pushLeg.id, displayedPrice: -110 },
      ],
      stakeCents: 10_000,
    });
    assert.ok(placed.ok);
    if (!placed.ok) return;

    h.context.repositories.events.recordResult(fight.id, resultFor(fight, 'Fighter G', [0, 1]), new Date().toISOString());
    h.context.repositories.events.recordResult(game.id, resultFor(game, 'Home', [21, 24]), new Date().toISOString());
    h.context.settlement.settleEvent(fight.id);

    const settled = h.context.betting.findBet(placed.bet.id);
    assert.equal(settled?.status, 'WON');
    // The pushed leg drops out; the bet pays at the surviving -150 alone.
    assert.equal(settled?.payoutCents, 16_667);
    assert.equal(h.context.wallet.getWallet().balanceCents, 1_006_667);
    assert.ok(h.context.wallet.reconcile().balanced);
  } finally {
    h.close();
  }
});
