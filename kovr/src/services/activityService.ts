/**
 * The activity feed.
 *
 * Derived from the wallet ledger rather than kept as a separate table, so it
 * can never drift out of step with the money it describes.
 */

import type { ActivityItem, WalletTransaction } from '../domain/types.js';
import { formatCentsSigned } from '../core/money.js';
import type { WalletService } from './walletService.js';
import type { BetService } from './betService.js';

function kindFor(type: WalletTransaction['type']): ActivityItem['kind'] {
  switch (type) {
    case 'DEMO_DEPOSIT':
      return 'DEPOSIT';
    case 'DEMO_WITHDRAWAL':
      return 'WITHDRAWAL';
    case 'BET_PLACED':
      return 'BET';
    case 'BET_PAYOUT':
      return 'PAYOUT';
    case 'BET_REFUND':
      return 'REFUND';
    case 'DEMO_INITIAL_BALANCE':
      return 'SYSTEM';
  }
}

function titleFor(type: WalletTransaction['type']): string {
  switch (type) {
    case 'DEMO_DEPOSIT':
      return 'Deposit';
    case 'DEMO_WITHDRAWAL':
      return 'Withdrawal';
    case 'BET_PLACED':
      return 'Bet placed';
    case 'BET_PAYOUT':
      return 'Bet won';
    case 'BET_REFUND':
      return 'Stake returned';
    case 'DEMO_INITIAL_BALANCE':
      return 'Opening balance';
  }
}

export class ActivityService {
  constructor(
    private readonly wallet: WalletService,
    private readonly bets: BetService,
  ) {}

  list(limit = 50): ActivityItem[] {
    const transactions = this.wallet.listTransactions(limit);
    // One lookup of recent bets lets a ledger row name what it was staked on.
    const betNames = new Map(
      this.bets
        .listBets(undefined, 200)
        .map((bet) => [
          bet.id,
          bet.selections.length === 1
            ? (bet.selections[0]?.selectionName ?? 'Selection')
            : `${bet.selections.length}-leg parlay`,
        ]),
    );

    return transactions.map((transaction): ActivityItem => {
      const detail = transaction.betId ? (betNames.get(transaction.betId) ?? transaction.description) : transaction.description;
      return {
        id: transaction.id,
        kind: kindFor(transaction.type),
        title: titleFor(transaction.type),
        detail,
        amountCents: transaction.amountCents,
        status: formatCentsSigned(transaction.amountCents),
        createdAt: transaction.createdAt,
      };
    });
  }
}
