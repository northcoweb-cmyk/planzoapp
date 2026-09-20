import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from './support/harness.js';
import { WalletError } from '../src/services/walletService.js';

test('the demo account opens with a ledger entry, not an assigned balance', () => {
  const h = createHarness();
  try {
    const { wallet } = h.context.wallet.ensureDemoAccount();
    assert.equal(wallet.balanceCents, 1_000_000, 'opens at $10,000.00');

    const ledger = h.context.wallet.listTransactions();
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0]?.type, 'DEMO_INITIAL_BALANCE');
    assert.equal(ledger[0]?.balanceAfterCents, 1_000_000);

    const check = h.context.wallet.reconcile();
    assert.ok(check.balanced, 'ledger equals balance from the very first row');
  } finally {
    h.close();
  }
});

test('ensureDemoAccount is idempotent and never double-credits', () => {
  const h = createHarness();
  try {
    for (let i = 0; i < 5; i++) h.context.wallet.ensureDemoAccount();
    assert.equal(h.context.wallet.getWallet().balanceCents, 1_000_000);
    assert.equal(h.context.wallet.listTransactions().length, 1);
  } finally {
    h.close();
  }
});

test('deposits and withdrawals reconcile exactly', () => {
  const h = createHarness();
  try {
    h.context.wallet.ensureDemoAccount();
    h.context.wallet.deposit(50_000);
    h.context.wallet.deposit(12_345);
    h.context.wallet.withdraw(7_500);

    const expected = 1_000_000 + 50_000 + 12_345 - 7_500;
    assert.equal(h.context.wallet.getWallet().balanceCents, expected);

    const check = h.context.wallet.reconcile();
    assert.equal(check.ledgerTotalCents, expected);
    assert.equal(check.balanceCents, expected);
    assert.ok(check.balanced);
    assert.equal(check.entries, 4);
  } finally {
    h.close();
  }
});

test('a withdrawal larger than the balance is refused', () => {
  const h = createHarness();
  try {
    h.context.wallet.ensureDemoAccount();
    assert.throws(() => h.context.wallet.withdraw(2_000_000), (error: unknown) => {
      assert.ok(error instanceof WalletError);
      assert.equal(error.code, 'INSUFFICIENT_FUNDS');
      return true;
    });
    assert.equal(h.context.wallet.getWallet().balanceCents, 1_000_000, 'balance is untouched');
    assert.ok(h.context.wallet.reconcile().balanced);
  } finally {
    h.close();
  }
});

test('amounts outside the permitted band are refused', () => {
  const h = createHarness();
  try {
    h.context.wallet.ensureDemoAccount();
    for (const bad of [0, -100, 1.5, 4_99]) {
      assert.throws(() => h.context.wallet.deposit(bad), WalletError, `deposit ${bad}`);
    }
    assert.throws(() => h.context.wallet.deposit(50_000_00), WalletError, 'above the cap');
    assert.equal(h.context.wallet.listTransactions().length, 1, 'no failed attempt wrote a row');
  } finally {
    h.close();
  }
});

test('a demo reset restores the opening balance and clears history', () => {
  const h = createHarness();
  try {
    h.context.wallet.ensureDemoAccount();
    h.context.wallet.deposit(25_000);
    h.context.wallet.withdraw(10_000);

    const after = h.context.wallet.resetDemo();
    assert.equal(after.wallet.balanceCents, 1_000_000);
    const ledger = h.context.wallet.listTransactions();
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0]?.type, 'DEMO_INITIAL_BALANCE');
    assert.ok(h.context.wallet.reconcile().balanced);
  } finally {
    h.close();
  }
});
