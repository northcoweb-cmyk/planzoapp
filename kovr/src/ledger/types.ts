/** The shape of the stored ledger document. */

import type { Bet, Wallet, WalletTransaction } from '../domain/types.js';

export const LEDGER_VERSION = 1;

export interface LedgerState {
  version: number;
  createdAt: string;
  wallet: Wallet;
  /** Newest last. The wallet balance is always the sum of these. */
  transactions: WalletTransaction[];
  bets: Bet[];
  /** Bet ids that have been settled. The guard against paying twice. */
  settledBetIds: string[];
}

export interface Reconciliation {
  ledgerTotalCents: number;
  balanceCents: number;
  balanced: boolean;
  entries: number;
}
