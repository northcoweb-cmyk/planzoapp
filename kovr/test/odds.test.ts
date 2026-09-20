import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidAmericanOdds,
  parseAmericanOdds,
  formatAmericanOdds,
  profitCents,
  payoutCents,
  toDecimalOdds,
  fromDecimalOdds,
  impliedProbability,
  combineParlayOdds,
  oddsChanged,
  isBetterForBettor,
  OddsError,
} from '../src/core/odds.js';

test('American odds validity mirrors the real format', () => {
  for (const good of [100, -100, 150, -110, 2500, -10_000]) {
    assert.ok(isValidAmericanOdds(good), `${good} should be valid`);
  }
  for (const bad of [0, 99, -99, 1, -1, 1.5, -110.5, NaN, Infinity, '−110', null, undefined]) {
    assert.ok(!isValidAmericanOdds(bad), `${String(bad)} should be invalid`);
  }
});

test('parsing accepts provider and user spellings', () => {
  assert.equal(parseAmericanOdds('+150'), 150);
  assert.equal(parseAmericanOdds('-110'), -110);
  assert.equal(parseAmericanOdds(' 225 '), 225);
  assert.throws(() => parseAmericanOdds('even'), OddsError);
  assert.throws(() => parseAmericanOdds(0), OddsError);
});

test('formatting always carries an explicit sign', () => {
  assert.equal(formatAmericanOdds(150), '+150');
  assert.equal(formatAmericanOdds(-110), '-110');
  assert.equal(formatAmericanOdds(100), '+100');
});

test('payouts match the specified reference cases exactly', () => {
  // $100 at +100 -> $100 profit, $200 back
  assert.equal(profitCents(10_000, 100), 10_000);
  assert.equal(payoutCents(10_000, 100), 20_000);

  // $100 at +150 -> $150 profit, $250 back
  assert.equal(profitCents(10_000, 150), 15_000);
  assert.equal(payoutCents(10_000, 150), 25_000);

  // $100 at -150 -> $66.67 profit, $166.67 back
  assert.equal(profitCents(10_000, -150), 6_667);
  assert.equal(payoutCents(10_000, -150), 16_667);

  // $100 at -110 -> $90.91 profit, $190.91 back
  assert.equal(profitCents(10_000, -110), 9_091);
  assert.equal(payoutCents(10_000, -110), 19_091);

  // A UFC favourite at -250 on a $25 stake
  assert.equal(profitCents(2_500, -250), 1_000);
  assert.equal(payoutCents(2_500, -250), 3_500);
});

test('payout never loses or invents a cent through rounding', () => {
  for (let stake = 1; stake <= 2_000; stake++) {
    for (const odds of [100, -100, 110, -110, 137, -137, 150, -150, 999, -999]) {
      const profit = profitCents(stake, odds);
      assert.ok(Number.isSafeInteger(profit), 'profit must be whole cents');
      assert.ok(profit >= 0, 'profit is never negative');
      assert.equal(payoutCents(stake, odds), stake + profit);
    }
  }
});

test('a zero stake pays nothing and a negative stake is rejected', () => {
  assert.equal(profitCents(0, -150), 0);
  assert.equal(payoutCents(0, -150), 0);
  assert.throws(() => profitCents(-1, -150));
});

test('decimal conversion round-trips American prices', () => {
  assert.equal(toDecimalOdds(100), 2);
  assert.equal(toDecimalOdds(150), 2.5);
  assert.ok(Math.abs(toDecimalOdds(-110) - 1.909090909) < 1e-6);
  for (const odds of [100, 150, -150, 250, -250, 1200, -1200, 137, -137]) {
    assert.equal(fromDecimalOdds(toDecimalOdds(odds)), odds);
  }
  // Even money has two American spellings; decimal 2.0 normalises to +100.
  assert.equal(toDecimalOdds(-100), 2);
  assert.equal(fromDecimalOdds(toDecimalOdds(-100)), 100);
  assert.throws(() => fromDecimalOdds(1), OddsError);
  assert.throws(() => fromDecimalOdds(0.5), OddsError);
});

test('implied probability sits inside (0,1) and favours favourites', () => {
  assert.ok(impliedProbability(-150) > impliedProbability(150));
  assert.ok(Math.abs(impliedProbability(100) - 0.5) < 1e-12);
  for (const odds of [-10_000, -110, 100, 5000]) {
    const p = impliedProbability(odds);
    assert.ok(p > 0 && p < 1);
  }
});

test('parlay pricing multiplies decimal legs', () => {
  assert.equal(combineParlayOdds([-110]), -110);
  // -110 x -110 = 1.90909 x 1.90909 = 3.6446 -> +264
  assert.equal(combineParlayOdds([-110, -110]), 264);
  assert.equal(combineParlayOdds([100, 100]), 300);
  assert.throws(() => combineParlayOdds([]), OddsError);
});

test('odds movement detection drives the confirmation prompt', () => {
  assert.ok(oddsChanged(-150, -175));
  assert.ok(!oddsChanged(-150, -150));
  assert.ok(!oddsChanged('-150', -150));
  assert.ok(isBetterForBettor(-150, -120), '-120 pays more than -150');
  assert.ok(!isBetterForBettor(-150, -175), '-175 pays less than -150');
  assert.ok(isBetterForBettor(-150, 110));
});
