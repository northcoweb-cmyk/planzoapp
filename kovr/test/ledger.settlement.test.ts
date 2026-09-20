import test from 'node:test';
import assert from 'node:assert/strict';
import { cancelled, createLedger, eventMap, liveMap, withResult } from './support/ledgerHarness.js';
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
import type { Ledger } from '../src/ledger/ledger.js';

function fightCard() {
  const event = buildEvent({
    providerEventId: 'ufc-settle-1',
    league: UFC_LEAGUE,
    competitors: ['Fighter B', 'Fighter A'],
    startTime: isoIn(2),
  });
  return { event, market: moneylineMarket(event, [125, -150]) };
}

async function backFighterA(ledger: Ledger, event: ReturnType<typeof fightCard>['event'], market: ReturnType<typeof fightCard>['market']) {
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
  if (!placed.ok) throw new Error('bet rejected');
  return placed.bet;
}

test('a winner pays the exact calculated amount', async () => {
  const ledger = createLedger();
  const { event, market } = fightCard();
  const bet = await backFighterA(ledger, event, market);

  const outcomes = await ledger.settle(eventMap(withResult(event, resultFor(event, 'Fighter A', [0, 1]))));
  assert.equal(outcomes[0]?.status, 'WON');
  assert.equal(outcomes[0]?.payoutCents, 16_667);

  const settled = await ledger.findBet(bet.id);
  assert.equal(settled?.status, 'WON');
  assert.equal(settled?.payoutCents, 16_667);
  assert.equal(settled?.priceAmerican, -150, 'graded at the placed price');

  assert.equal((await ledger.wallet()).balanceCents, 1_006_667);
  assert.ok((await ledger.reconcile()).balanced);

  const payout = (await ledger.transactions()).find((t) => t.type === 'BET_PAYOUT');
  assert.equal(payout?.amountCents, 16_667);
  assert.equal(payout?.betId, bet.id);
});

test('a losing bet pays nothing', async () => {
  const ledger = createLedger();
  const { event, market } = fightCard();
  const bet = await backFighterA(ledger, event, market);

  await ledger.settle(eventMap(withResult(event, resultFor(event, 'Fighter B', [1, 0]))));

  const settled = await ledger.findBet(bet.id);
  assert.equal(settled?.status, 'LOST');
  assert.equal(settled?.payoutCents, 0);
  assert.equal((await ledger.wallet()).balanceCents, 990_000);
  assert.equal((await ledger.transactions()).filter((t) => t.type === 'BET_PAYOUT').length, 0);
  assert.ok((await ledger.reconcile()).balanced);
});

test('nothing settles merely because the start time has passed', async () => {
  const ledger = createLedger();
  const { event, market } = fightCard();
  const bet = await backFighterA(ledger, event, market);

  // Hours later, still no confirmed result on file.
  const stillRunning = { ...event, startTime: isoIn(-4), status: 'UNKNOWN' as const };
  const outcomes = await ledger.settle(eventMap(stillRunning));

  assert.equal(outcomes[0]?.status, 'PENDING');
  assert.equal((await ledger.findBet(bet.id))?.status, 'OPEN');
  assert.equal((await ledger.transactions()).filter((t) => t.type === 'BET_PAYOUT').length, 0);
});

test('an event KOVR could not fetch leaves its bet open, not void', async () => {
  const ledger = createLedger();
  const { event, market } = fightCard();
  const bet = await backFighterA(ledger, event, market);

  const outcomes = await ledger.settle(eventMap());
  assert.equal(outcomes.length, 0, 'nothing was graded');
  assert.equal((await ledger.findBet(bet.id))?.status, 'OPEN');
  assert.equal((await ledger.wallet()).balanceCents, 990_000);
});

test('settling repeatedly never pays twice', async () => {
  const ledger = createLedger();
  const { event, market } = fightCard();
  await backFighterA(ledger, event, market);
  const confirmed = eventMap(withResult(event, resultFor(event, 'Fighter A', [0, 1])));

  for (let i = 0; i < 10; i++) await ledger.settle(confirmed);

  assert.equal((await ledger.wallet()).balanceCents, 1_006_667, 'credited exactly once');
  assert.equal((await ledger.transactions()).filter((t) => t.type === 'BET_PAYOUT').length, 1);
  assert.ok((await ledger.reconcile()).balanced);
});

test('a cancelled event voids its bets and returns the stake', async () => {
  const ledger = createLedger();
  const { event, market } = fightCard();
  const bet = await backFighterA(ledger, event, market);

  await ledger.settle(eventMap(cancelled(event)));

  const settled = await ledger.findBet(bet.id);
  assert.equal(settled?.status, 'VOID');
  assert.equal(settled?.payoutCents, 10_000);
  assert.equal((await ledger.wallet()).balanceCents, 1_000_000);
  assert.equal((await ledger.transactions()).find((t) => t.type === 'BET_REFUND')?.amountCents, 10_000);
  assert.ok((await ledger.reconcile()).balanced);
});

test('a drawn two-way moneyline pushes and returns the stake', async () => {
  const ledger = createLedger();
  const { event, market } = fightCard();
  const bet = await backFighterA(ledger, event, market);

  await ledger.settle(eventMap(withResult(event, resultFor(event, null, [1, 1]))));

  const settled = await ledger.findBet(bet.id);
  assert.equal(settled?.status, 'PUSH');
  assert.equal(settled?.payoutCents, 10_000);
  assert.equal((await ledger.wallet()).balanceCents, 1_000_000);
  assert.ok((await ledger.reconcile()).balanced);
});

test('a spread landing exactly on the number pushes', async () => {
  const ledger = createLedger();
  const game = buildEvent({
    providerEventId: 'nfl-spread',
    league: NFL_LEAGUE,
    competitors: ['Ravens', 'Chiefs'],
    startTime: isoIn(3),
  });
  const spread = spreadMarket(game, [3, -3], [-110, -110]);
  const chiefs = spread.selections[1];
  assert.ok(chiefs);

  const placed = await ledger.place(
    {
      selections: [{ eventId: game.id, marketKey: 'spreads', selectionId: chiefs.id, displayedPrice: -110 }],
      stakeCents: 10_000,
    },
    liveMap({ event: game, markets: [spread] }),
  );
  assert.ok(placed.ok);
  if (!placed.ok) return;

  // Chiefs win 24-21: a three-point margin against a -3 line is a push.
  await ledger.settle(eventMap(withResult(game, resultFor(game, 'Chiefs', [21, 24]))));

  const settled = await ledger.findBet(placed.bet.id);
  assert.equal(settled?.status, 'PUSH');
  assert.equal(settled?.payoutCents, 10_000);
  assert.equal((await ledger.wallet()).balanceCents, 1_000_000);
});

test('totals grade over, under and the exact number', async () => {
  const cases: Array<[number, [number, number], 'WON' | 'LOST' | 'PUSH', 'Over' | 'Under']> = [
    [47.5, [24, 27], 'WON', 'Over'],
    [47.5, [10, 13], 'LOST', 'Over'],
    [47.5, [10, 13], 'WON', 'Under'],
    [48, [24, 24], 'PUSH', 'Over'],
    [48, [24, 24], 'PUSH', 'Under'],
  ];

  for (const [index, [line, scores, expected, side]] of cases.entries()) {
    const ledger = createLedger();
    const game = buildEvent({
      providerEventId: `nfl-total-${index}`,
      league: NFL_LEAGUE,
      competitors: [`Away${index}`, `Home${index}`],
      startTime: isoIn(4),
    });
    const total = totalsMarket(game, line, [-110, -110]);
    const selection = total.selections.find((s) => s.name === side);
    assert.ok(selection);

    const placed = await ledger.place(
      {
        selections: [{ eventId: game.id, marketKey: 'totals', selectionId: selection.id, displayedPrice: -110 }],
        stakeCents: 1_000,
      },
      liveMap({ event: game, markets: [total] }),
    );
    assert.ok(placed.ok, `${side} ${line}`);
    if (!placed.ok) continue;

    const winner = scores[1] > scores[0] ? `Home${index}` : `Away${index}`;
    await ledger.settle(eventMap(withResult(game, resultFor(game, winner, scores))));

    const settled = await ledger.findBet(placed.bet.id);
    assert.equal(settled?.status, expected, `${side} ${line} with ${scores.join('-')}`);
    assert.ok((await ledger.reconcile()).balanced);
  }
});

test('a market KOVR cannot grade leaves the bet open rather than guessing', async () => {
  const ledger = createLedger();
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

  const placed = await ledger.place(
    {
      selections: [{ eventId: game.id, marketKey: 'player_pass_tds', selectionId: 'sel_prop_over', displayedPrice: -120 }],
      stakeCents: 2_000,
    },
    liveMap({ event: game, markets: [prop] }),
  );
  assert.ok(placed.ok);
  if (!placed.ok) return;

  const outcomes = await ledger.settle(eventMap(withResult(game, resultFor(game, 'Home', [17, 27]))));
  assert.equal(outcomes[0]?.status, 'PENDING');
  assert.equal((await ledger.findBet(placed.bet.id))?.status, 'OPEN');
  assert.equal((await ledger.transactions()).filter((t) => t.type === 'BET_PAYOUT').length, 0);
});

test('a parlay with one pushed leg reprices on the surviving legs', async () => {
  const ledger = createLedger();
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

  const winner = fightMarket.selections[1];
  const pushLeg = spread.selections[1];
  assert.ok(winner && pushLeg);

  const placed = await ledger.place(
    {
      selections: [
        { eventId: fight.id, marketKey: 'h2h', selectionId: winner.id, displayedPrice: -150 },
        { eventId: game.id, marketKey: 'spreads', selectionId: pushLeg.id, displayedPrice: -110 },
      ],
      stakeCents: 10_000,
    },
    liveMap({ event: fight, markets: [fightMarket] }, { event: game, markets: [spread] }),
  );
  assert.ok(placed.ok);
  if (!placed.ok) return;

  await ledger.settle(
    eventMap(
      withResult(fight, resultFor(fight, 'Fighter G', [0, 1])),
      withResult(game, resultFor(game, 'Home', [21, 24])),
    ),
  );

  const settled = await ledger.findBet(placed.bet.id);
  assert.equal(settled?.status, 'WON');
  // The pushed leg drops out; the bet pays at the surviving -150 alone.
  assert.equal(settled?.payoutCents, 16_667);
  assert.equal((await ledger.wallet()).balanceCents, 1_006_667);
  assert.ok((await ledger.reconcile()).balanced);
});

test('openEventIds names exactly what the client must fetch', async () => {
  const ledger = createLedger();
  const { event, market } = fightCard();
  await backFighterA(ledger, event, market);

  assert.deepEqual(await ledger.openEventIds(), [event.id]);
  await ledger.settle(eventMap(withResult(event, resultFor(event, 'Fighter A', [0, 1]))));
  assert.deepEqual(await ledger.openEventIds(), [], 'nothing left to watch once settled');
});
