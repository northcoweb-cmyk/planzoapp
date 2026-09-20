/** Balance, funding and the full transaction history. */

import { h } from '../dom.js';
import type { RawHtml } from '../dom.js';
import { icon } from '../icons.js';
import { emptyState, skeletonList } from '../components.js';
import { dateTime, money, moneySigned } from '../format.js';
import { ledger } from '../ledgerClient.js';

const QUICK_ADD = [50, 100, 500];

export function walletSkeleton(): RawHtml {
  return h`<div class="view"><div class="skeleton skeleton--hero"></div>${skeletonList(4, 'row')}</div>`;
}

export async function renderWallet(): Promise<RawHtml> {
  const store = await ledger();
  const [wallet, transactions, counts] = await Promise.all([
    store.wallet(),
    store.transactions(60),
    store.counts(),
  ]);

  const rows =
    transactions.length === 0
      ? emptyState('No transactions yet', 'Every balance change is recorded here.')
      : h`<div class="card">${transactions.map(
          (transaction, index) => h`
            <div class="row fade-up" style="animation-delay:${Math.min(index, 10) * 25}ms">
              <span class="avatar" aria-hidden="true">${icon(
                transaction.amountCents >= 0 ? 'download' : 'upload',
                16,
              )}</span>
              <span class="row__body">
                <span class="row__title">${transaction.description}</span>
                <span class="row__meta">${dateTime(transaction.createdAt)}</span>
              </span>
              <span class="row__value">
                <span class="${
                  transaction.amountCents >= 0
                    ? 'row__amount row__amount--credit num'
                    : 'row__amount row__amount--debit num'
                }">${moneySigned(transaction.amountCents)}</span>
                <span class="row__meta num">${money(transaction.balanceAfterCents)}</span>
              </span>
            </div>`,
        )}</div>`;

  return h`
    <div class="view">
      <header class="view-header fade-up"><h1 class="view-title">Wallet</h1></header>

      <section class="wallet-hero fade-up">
        <div class="wallet-hero__glow" aria-hidden="true"></div>
        <p class="wallet-hero__label">Balance</p>
        <p class="wallet-hero__amount num" data-balance-display>${money(wallet.balanceCents)}</p>
        <div class="wallet-hero__stats">
          <span><strong class="num">${counts.OPEN}</strong> open</span>
          <span><strong class="num">${counts.WON}</strong> won</span>
          <span><strong class="num">${transactions.length}</strong> entries</span>
        </div>
      </section>

      <section class="section fade-up">
        <h2 class="section-title">Add funds</h2>
        <div class="btn-grid">
          ${QUICK_ADD.map(
            (amount) => h`<button class="btn" type="button" data-deposit="${String(amount * 100)}">
              ${icon('plus', 15)} $${amount}
            </button>`,
          )}
        </div>
        <div class="inline-form">
          <div class="stake-field">
            <span class="stake-field__prefix">$</span>
            <input type="number" inputmode="decimal" min="5" step="0.01" placeholder="Amount"
              data-custom-amount aria-label="Amount" />
          </div>
          <button class="btn btn--primary" type="button" data-deposit-custom>Add</button>
        </div>
      </section>

      <section class="section fade-up">
        <h2 class="section-title">Withdraw</h2>
        <div class="btn-grid">
          ${[100, 500].map(
            (amount) => h`<button class="btn" type="button" data-withdraw="${String(amount * 100)}">
              ${icon('minus', 15)} $${amount}
            </button>`,
          )}
          <button class="btn" type="button" data-withdraw-all>All</button>
        </div>
      </section>

      <section class="section fade-up">
        <div class="section__head">
          <h2 class="section-title">History</h2>
          <span class="dim">${transactions.length}</span>
        </div>
        ${rows}
      </section>
    </div>`;
}

export async function renderActivity(): Promise<RawHtml> {
  const store = await ledger();
  const [transactions, bets] = await Promise.all([store.transactions(80), store.bets(undefined, 200)]);
  const names = new Map(
    bets.map((bet) => [
      bet.id,
      bet.selections.length === 1 ? (bet.selections[0]?.selectionName ?? 'Selection') : `${bet.selections.length}-leg parlay`,
    ]),
  );

  const body =
    transactions.length === 0
      ? emptyState('Nothing yet', 'Bets, deposits, withdrawals and returns all appear here.')
      : h`<div class="card">${transactions.map(
          (item, index) => h`
            <div class="row fade-up" style="animation-delay:${Math.min(index, 10) * 25}ms">
              <span class="row__body">
                <span class="row__title">${
                  item.betId ? (names.get(item.betId) ?? item.description) : item.description
                }</span>
                <span class="row__meta">${dateTime(item.createdAt)}</span>
              </span>
              <span class="row__value">
                <span class="${
                  item.amountCents >= 0 ? 'row__amount row__amount--credit num' : 'row__amount row__amount--debit num'
                }">${moneySigned(item.amountCents)}</span>
              </span>
            </div>`,
        )}</div>`;

  return h`
    <div class="view">
      <header class="view-header fade-up"><h1 class="view-title">Activity</h1></header>
      ${body}
    </div>`;
}
