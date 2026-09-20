/**
 * The simulated wallet and its ledger.
 *
 * The balance is never assigned; it is only ever moved by a transaction row.
 * Every credit and debit writes a `wallet_transactions` record carrying the
 * resulting balance, so the ledger can be replayed and reconciled against the
 * stored balance at any time.
 *
 * No real funds are involved anywhere in this file.
 */

import type { Database } from '../db.js';
import { isUniqueViolation } from '../db.js';
import type { Cents } from '../../core/money.js';
import { assertCents } from '../../core/money.js';
import type { TransactionType, Wallet, WalletTransaction } from '../../domain/types.js';
import { newId } from '../../domain/identity.js';
import { enumOf, num, str, strOrNull } from '../rows.js';
import type { Row } from '../db.js';

const TRANSACTION_TYPES: readonly TransactionType[] = [
  'DEMO_INITIAL_BALANCE',
  'DEMO_DEPOSIT',
  'BET_PLACED',
  'BET_PAYOUT',
  'BET_REFUND',
  'DEMO_WITHDRAWAL',
];

export class InsufficientFundsError extends Error {
  readonly code = 'INSUFFICIENT_FUNDS';
  readonly balanceCents: Cents;
  readonly requiredCents: Cents;

  constructor(balanceCents: Cents, requiredCents: Cents) {
    super('Insufficient simulated funds');
    this.name = 'InsufficientFundsError';
    this.balanceCents = balanceCents;
    this.requiredCents = requiredCents;
  }
}

/** Raised when an idempotency key has already been used. */
export class DuplicateTransactionError extends Error {
  readonly code = 'DUPLICATE_TRANSACTION';
  constructor(public readonly idempotencyKey: string) {
    super(`A transaction with key "${idempotencyKey}" already exists`);
    this.name = 'DuplicateTransactionError';
  }
}

export interface PostTransaction {
  walletId: string;
  type: TransactionType;
  /** Signed: positive credits, negative debits. Never zero. */
  amountCents: Cents;
  description: string;
  betId?: string | null;
  /** When supplied, the same key can never post twice. */
  idempotencyKey?: string | null;
}

export class WalletRepository {
  constructor(private readonly database: Database) {}

  private static toWallet(row: Row): Wallet {
    return {
      id: str(row, 'id'),
      userId: str(row, 'user_id'),
      balanceCents: num(row, 'balance_cents'),
      currency: 'USD',
      updatedAt: str(row, 'updated_at'),
    };
  }

  createWallet(userId: string, at: string): Wallet {
    const id = newId('wal');
    this.database.run(
      `INSERT INTO wallets (id, user_id, balance_cents, currency, created_at, updated_at)
       VALUES (?, ?, 0, 'USD', ?, ?)`,
      id,
      userId,
      at,
      at,
    );
    const wallet = this.findByUser(userId);
    if (!wallet) throw new Error('wallet creation failed');
    return wallet;
  }

  findByUser(userId: string): Wallet | null {
    const row = this.database.get('SELECT * FROM wallets WHERE user_id = ?', userId);
    return row ? WalletRepository.toWallet(row) : null;
  }

  findById(walletId: string): Wallet | null {
    const row = this.database.get('SELECT * FROM wallets WHERE id = ?', walletId);
    return row ? WalletRepository.toWallet(row) : null;
  }

  /**
   * Post one balance-changing entry.
   *
   * Reads the balance, applies the delta, refuses to go negative, writes the
   * ledger row and updates the wallet — all inside a single transaction, so a
   * concurrent bet cannot spend the same simulated dollar twice.
   */
  post(entry: PostTransaction, at: string): WalletTransaction {
    assertCents(entry.amountCents, 'transaction amount');
    if (entry.amountCents === 0) {
      throw new Error('a wallet transaction cannot be for zero');
    }

    return this.database.transaction(() => {
      const wallet = this.findById(entry.walletId);
      if (!wallet) throw new Error(`wallet ${entry.walletId} not found`);

      const nextBalance = wallet.balanceCents + entry.amountCents;
      assertCents(nextBalance, 'resulting balance');
      if (nextBalance < 0) {
        throw new InsufficientFundsError(wallet.balanceCents, Math.abs(entry.amountCents));
      }

      const id = newId('txn');
      try {
        this.database.run(
          `INSERT INTO wallet_transactions
             (id, wallet_id, type, amount_cents, balance_after_cents, description, bet_id, idempotency_key, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          id,
          entry.walletId,
          entry.type,
          entry.amountCents,
          nextBalance,
          entry.description,
          entry.betId ?? null,
          entry.idempotencyKey ?? null,
          at,
        );
      } catch (error) {
        if (entry.idempotencyKey && isUniqueViolation(error)) {
          throw new DuplicateTransactionError(entry.idempotencyKey);
        }
        throw error;
      }

      this.database.run(
        'UPDATE wallets SET balance_cents = ?, updated_at = ? WHERE id = ?',
        nextBalance,
        at,
        entry.walletId,
      );

      return {
        id,
        walletId: entry.walletId,
        type: entry.type,
        amountCents: entry.amountCents,
        balanceAfterCents: nextBalance,
        description: entry.description,
        betId: entry.betId ?? null,
        createdAt: at,
      };
    });
  }

  private static toTransaction(row: Row): WalletTransaction {
    return {
      id: str(row, 'id'),
      walletId: str(row, 'wallet_id'),
      type: enumOf(row, 'type', TRANSACTION_TYPES),
      amountCents: num(row, 'amount_cents'),
      balanceAfterCents: num(row, 'balance_after_cents'),
      description: str(row, 'description'),
      betId: strOrNull(row, 'bet_id'),
      createdAt: str(row, 'created_at'),
    };
  }

  listTransactions(walletId: string, limit = 100, types?: readonly TransactionType[]): WalletTransaction[] {
    const bounded = Math.min(500, Math.max(1, limit));
    if (types && types.length > 0) {
      const placeholders = types.map(() => '?').join(', ');
      return this.database
        .all(
          `SELECT * FROM wallet_transactions
            WHERE wallet_id = ? AND type IN (${placeholders})
            ORDER BY created_at DESC, rowid DESC LIMIT ?`,
          walletId,
          ...types,
          bounded,
        )
        .map(WalletRepository.toTransaction);
    }
    return this.database
      .all(
        'SELECT * FROM wallet_transactions WHERE wallet_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?',
        walletId,
        bounded,
      )
      .map(WalletRepository.toTransaction);
  }

  /**
   * Replay the ledger and compare it with the stored balance.
   *
   * A mismatch means the wallet and its history disagree, which is the one
   * accounting failure that must never be shrugged off.
   */
  reconcile(walletId: string): { ledgerTotalCents: Cents; balanceCents: Cents; balanced: boolean; entries: number } {
    const rows = this.database.all(
      'SELECT amount_cents FROM wallet_transactions WHERE wallet_id = ?',
      walletId,
    );
    let total = 0;
    for (const row of rows) total += num(row, 'amount_cents');

    const wallet = this.findById(walletId);
    const balance = wallet ? wallet.balanceCents : 0;
    return { ledgerTotalCents: total, balanceCents: balance, balanced: total === balance, entries: rows.length };
  }

  /** Developer-only: wipe the ledger and balance for a demo account. */
  resetWallet(walletId: string, at: string): void {
    this.database.transaction(() => {
      this.database.run('DELETE FROM wallet_transactions WHERE wallet_id = ?', walletId);
      this.database.run('UPDATE wallets SET balance_cents = 0, updated_at = ? WHERE id = ?', at, walletId);
    });
  }
}
