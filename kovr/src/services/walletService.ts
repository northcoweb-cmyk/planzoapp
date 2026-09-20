/**
 * The simulated wallet.
 *
 * KOVR holds no real money. Deposits and withdrawals move a number in a
 * SQLite table and nothing else: no bank is contacted, no card is stored, no
 * payment is processed, and no real account detail is ever requested.
 *
 * The balance is only ever the sum of the ledger. Nothing may set it directly.
 */

import type { Cents } from '../core/money.js';
import { formatCents, MAX_CENTS } from '../core/money.js';
import type { Wallet, WalletTransaction } from '../domain/types.js';
import type { ProfileRepository, Profile } from '../store/repositories/profileRepo.js';
import type { WalletRepository } from '../store/repositories/walletRepo.js';
import type { BetRepository } from '../store/repositories/betRepo.js';
import { config } from '../config/env.js';

/** The single demo identity KOVR ships with. */
export const DEMO_USER_ID = 'demo-user';

/** The fictional destination shown on a simulated withdrawal. */
export const DEMO_WITHDRAWAL_DESTINATION = 'Demo Account •••• 4821';

export const MIN_DEPOSIT_CENTS = 500;
export const MAX_DEPOSIT_CENTS = 10_000_00;
export const MIN_WITHDRAWAL_CENTS = 500;

export class WalletError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'WalletError';
    this.code = code;
  }
}

export interface WalletView {
  wallet: Wallet;
  profile: Profile;
}

export class WalletService {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly wallets: WalletRepository,
    private readonly bets: BetRepository,
  ) {}

  /**
   * Create the demo profile, its wallet and the opening balance if they do
   * not exist yet. The opening balance is a ledger entry like any other, so
   * the account reconciles from its very first row.
   */
  ensureDemoAccount(at = new Date().toISOString()): WalletView {
    let profile = this.profiles.findById(DEMO_USER_ID);
    if (!profile) {
      profile = this.profiles.create(
        {
          id: DEMO_USER_ID,
          username: 'kovr_demo',
          email: 'demo@kovr.local',
          displayName: 'Demo Player',
          avatarInitials: 'DP',
          isDemo: true,
        },
        at,
      );
    }

    let wallet = this.wallets.findByUser(DEMO_USER_ID);
    if (!wallet) wallet = this.wallets.createWallet(DEMO_USER_ID, at);

    const opening = config().demoStartingBalanceCents;
    if (this.wallets.listTransactions(wallet.id, 1).length === 0 && opening > 0) {
      this.wallets.post(
        {
          walletId: wallet.id,
          type: 'DEMO_INITIAL_BALANCE',
          amountCents: opening,
          description: `Simulated opening balance of ${formatCents(opening)}`,
          idempotencyKey: `initial:${wallet.id}`,
        },
        at,
      );
      wallet = this.wallets.findByUser(DEMO_USER_ID) ?? wallet;
    }

    return { wallet, profile };
  }

  getWallet(): Wallet {
    return this.ensureDemoAccount().wallet;
  }

  getProfile(): Profile {
    return this.ensureDemoAccount().profile;
  }

  deposit(amountCents: Cents, at = new Date().toISOString()): WalletTransaction {
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      throw new WalletError('INVALID_AMOUNT', 'Enter an amount greater than zero.');
    }
    if (amountCents < MIN_DEPOSIT_CENTS) {
      throw new WalletError('AMOUNT_TOO_SMALL', `The smallest simulated deposit is ${formatCents(MIN_DEPOSIT_CENTS)}.`);
    }
    if (amountCents > MAX_DEPOSIT_CENTS) {
      throw new WalletError('AMOUNT_TOO_LARGE', `The largest simulated deposit is ${formatCents(MAX_DEPOSIT_CENTS)}.`);
    }

    const { wallet } = this.ensureDemoAccount(at);
    if (wallet.balanceCents + amountCents > MAX_CENTS) {
      throw new WalletError('BALANCE_LIMIT', 'That deposit would exceed the simulated balance limit.');
    }

    return this.wallets.post(
      {
        walletId: wallet.id,
        type: 'DEMO_DEPOSIT',
        amountCents,
        description: `Simulated deposit of ${formatCents(amountCents)}`,
      },
      at,
    );
  }

  /**
   * Withdraw simulated funds to a fictional destination.
   * The money is removed from the ledger and goes nowhere, because there is
   * nowhere for it to go.
   */
  withdraw(amountCents: Cents, at = new Date().toISOString()): WalletTransaction {
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      throw new WalletError('INVALID_AMOUNT', 'Enter an amount greater than zero.');
    }
    if (amountCents < MIN_WITHDRAWAL_CENTS) {
      throw new WalletError(
        'AMOUNT_TOO_SMALL',
        `The smallest simulated withdrawal is ${formatCents(MIN_WITHDRAWAL_CENTS)}.`,
      );
    }

    const { wallet } = this.ensureDemoAccount(at);
    if (amountCents > wallet.balanceCents) {
      throw new WalletError(
        'INSUFFICIENT_FUNDS',
        `Your simulated balance is ${formatCents(wallet.balanceCents)}.`,
      );
    }

    return this.wallets.post(
      {
        walletId: wallet.id,
        type: 'DEMO_WITHDRAWAL',
        amountCents: -amountCents,
        description: `Simulated withdrawal of ${formatCents(amountCents)} to ${DEMO_WITHDRAWAL_DESTINATION}`,
      },
      at,
    );
  }

  listTransactions(limit = 100): WalletTransaction[] {
    const { wallet } = this.ensureDemoAccount();
    return this.wallets.listTransactions(wallet.id, limit);
  }

  reconcile(): ReturnType<WalletRepository['reconcile']> {
    const { wallet } = this.ensureDemoAccount();
    return this.wallets.reconcile(wallet.id);
  }

  /**
   * Developer-only reset: clears bets, settlements and the ledger, then
   * re-posts the opening balance. Sports and event data are untouched.
   */
  resetDemo(at = new Date().toISOString()): WalletView {
    const { wallet } = this.ensureDemoAccount(at);
    this.bets.resetForUser(DEMO_USER_ID);
    this.wallets.resetWallet(wallet.id, at);

    const opening = config().demoStartingBalanceCents;
    if (opening > 0) {
      this.wallets.post(
        {
          walletId: wallet.id,
          type: 'DEMO_INITIAL_BALANCE',
          amountCents: opening,
          description: `Simulated opening balance of ${formatCents(opening)}`,
          idempotencyKey: `initial:${wallet.id}:${at}`,
        },
        at,
      );
    }
    return this.ensureDemoAccount(at);
  }
}
