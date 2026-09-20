import test from 'node:test';
import assert from 'node:assert/strict';
import { createLedger } from './support/ledgerHarness.js';
import { LedgerError } from '../src/ledger/ledger.js';

test('the account opens with a ledger entry, not an assigned balance', async () => {
  const ledger = createLedger();
  const wallet = await ledger.wallet();
  assert.equal(wallet.balanceCents, 1_000_000);

  const entries = await ledger.transactions();
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.type, 'DEMO_INITIAL_BALANCE');
  assert.equal(entries[0]?.balanceAfterCents, 1_000_000);
  assert.ok((await ledger.reconcile()).balanced);
});

test('loading repeatedly never double-credits', async () => {
  const ledger = createLedger();
  for (let i = 0; i < 5; i++) await ledger.load();
  assert.equal((await ledger.wallet()).balanceCents, 1_000_000);
  assert.equal((await ledger.transactions()).length, 1);
});

test('deposits and withdrawals reconcile exactly', async () => {
  const ledger = createLedger();
  await ledger.deposit(50_000);
  await ledger.deposit(12_345);
  await ledger.withdraw(7_500);

  const expected = 1_000_000 + 50_000 + 12_345 - 7_500;
  assert.equal((await ledger.wallet()).balanceCents, expected);

  const check = await ledger.reconcile();
  assert.equal(check.ledgerTotalCents, expected);
  assert.equal(check.balanceCents, expected);
  assert.ok(check.balanced);
  assert.equal(check.entries, 4);
});

test('a withdrawal larger than the balance is refused', async () => {
  const ledger = createLedger();
  await assert.rejects(() => ledger.withdraw(2_000_000), (error: unknown) => {
    assert.ok(error instanceof LedgerError);
    assert.equal(error.code, 'INSUFFICIENT_FUNDS');
    return true;
  });
  assert.equal((await ledger.wallet()).balanceCents, 1_000_000);
  assert.ok((await ledger.reconcile()).balanced);
});

test('amounts outside the permitted band are refused', async () => {
  const ledger = createLedger();
  for (const bad of [0, -100, 1.5, 499]) {
    await assert.rejects(() => ledger.deposit(bad), LedgerError, `deposit ${bad}`);
  }
  await assert.rejects(() => ledger.deposit(5_000_000), LedgerError, 'above the cap');
  assert.equal((await ledger.transactions()).length, 1, 'no failed attempt wrote a row');
});

test('setting the balance writes a transaction and still reconciles', async () => {
  const ledger = createLedger();

  await ledger.adjustBalance(2_500_000);
  assert.equal((await ledger.wallet()).balanceCents, 2_500_000);
  let check = await ledger.reconcile();
  assert.ok(check.balanced, 'a direct adjustment is still a ledger entry');
  assert.equal(check.entries, 2);

  await ledger.adjustBalance(50_000);
  assert.equal((await ledger.wallet()).balanceCents, 50_000);
  check = await ledger.reconcile();
  assert.ok(check.balanced);
  assert.equal(check.entries, 3);

  // Setting it to what it already is writes nothing.
  await ledger.adjustBalance(50_000);
  assert.equal((await ledger.reconcile()).entries, 3);

  await assert.rejects(() => ledger.adjustBalance(-1), LedgerError);
});

test('a reset restores the opening balance and clears history', async () => {
  const ledger = createLedger();
  await ledger.deposit(25_000);
  await ledger.withdraw(10_000);

  const wallet = await ledger.reset();
  assert.equal(wallet.balanceCents, 1_000_000);
  const entries = await ledger.transactions();
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.type, 'DEMO_INITIAL_BALANCE');
  assert.ok((await ledger.reconcile()).balanced);
});

test('the ledger survives a reload from storage', async () => {
  const { MemoryStorage } = await import('../src/ledger/storage.js');
  const { Ledger } = await import('../src/ledger/ledger.js');

  const storage = new MemoryStorage();
  const first = new Ledger(storage, 1_000_000);
  await first.deposit(33_333);
  assert.equal((await first.wallet()).balanceCents, 1_033_333);

  const second = new Ledger(storage, 1_000_000);
  assert.equal((await second.wallet()).balanceCents, 1_033_333, 'reopened, not reinitialised');
  assert.equal((await second.transactions()).length, 2);
  assert.ok((await second.reconcile()).balanced);
});

test('a corrupt document is replaced rather than bricking the wallet', async () => {
  const { MemoryStorage } = await import('../src/ledger/storage.js');
  const { Ledger } = await import('../src/ledger/ledger.js');

  const storage = new MemoryStorage();
  await storage.write('{ this is not json');
  const ledger = new Ledger(storage, 1_000_000);
  assert.equal((await ledger.wallet()).balanceCents, 1_000_000);
  assert.ok((await ledger.reconcile()).balanced);
});
