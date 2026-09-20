import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dollarsToCents,
  centsToDollars,
  parseAmountToCents,
  sumCents,
  scaleCents,
  formatCents,
  formatCentsSigned,
  roundHalfAwayFromZero,
  MoneyError,
} from '../src/core/money.js';

test('dollarsToCents survives binary floating point', () => {
  assert.equal(dollarsToCents(19.99), 1999);
  assert.equal(dollarsToCents(0.1 + 0.2), 30);
  assert.equal(dollarsToCents(1.005), 101);
  assert.equal(dollarsToCents(10_000), 1_000_000);
  assert.equal(dollarsToCents(0), 0);
});

test('centsToDollars round-trips', () => {
  for (const dollars of [0, 1, 19.99, 1234.56, 10_000]) {
    assert.equal(centsToDollars(dollarsToCents(dollars)), dollars);
  }
});

test('roundHalfAwayFromZero is symmetric across zero', () => {
  assert.equal(roundHalfAwayFromZero(0.5), 1);
  assert.equal(roundHalfAwayFromZero(-0.5), -1);
  assert.equal(roundHalfAwayFromZero(1.5), 2);
  assert.equal(roundHalfAwayFromZero(-1.5), -2);
  assert.equal(roundHalfAwayFromZero(2.4), 2);
  assert.equal(roundHalfAwayFromZero(-2.4), -2);
});

test('parseAmountToCents accepts the shapes a user actually types', () => {
  assert.equal(parseAmountToCents('100'), 10_000);
  assert.equal(parseAmountToCents('$1,250.50'), 125_050);
  assert.equal(parseAmountToCents(' 12.5 '), 1250);
  assert.equal(parseAmountToCents('0.07'), 7);
  assert.equal(parseAmountToCents(250), 25_000);
});

test('parseAmountToCents refuses to guess', () => {
  for (const bad of ['', 'abc', '10.123', '1.2.3', '--5', '1e3', '$', 'NaN', 'Infinity']) {
    assert.throws(() => parseAmountToCents(bad), MoneyError, `should reject ${JSON.stringify(bad)}`);
  }
});

test('amounts outside the supported range are rejected', () => {
  assert.throws(() => dollarsToCents(50_000_000), MoneyError);
  assert.throws(() => parseAmountToCents('99999999999'), MoneyError);
});

test('sumCents reconciles a ledger without drift', () => {
  const ledger = [1_000_000, -10_000, 16_667, -50_000, -100, 3];
  assert.equal(sumCents(ledger), 956_570);
  // 10,000 debits of one cent must land exactly on -$100.00
  assert.equal(sumCents(Array.from({ length: 10_000 }, () => -1)), -10_000);
});

test('scaleCents rounds to whole cents', () => {
  assert.equal(scaleCents(10_000, 1 / 3), 3333);
  assert.equal(scaleCents(10_000, 0.6667), 6667);
  assert.equal(scaleCents(-10_000, 0.5), -5000);
});

test('formatting is stable US currency', () => {
  assert.equal(formatCents(1_000_000), '$10,000.00');
  assert.equal(formatCents(16_667), '$166.67');
  assert.equal(formatCents(0), '$0.00');
  assert.equal(formatCentsSigned(16_667), '+$166.67');
  assert.equal(formatCentsSigned(-10_000), '-$100.00');
});
