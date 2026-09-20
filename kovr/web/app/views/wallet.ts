/**
 * The simulated wallet.
 *
 * Deposits and withdrawals move a number in KOVR's own database. No bank is
 * contacted, no card is stored, and no real account detail is ever requested
 * — the destination shown on a withdrawal is fictional on purpose.
 */

import { h } from '../dom.js';
import type { RawHtml } from '../dom.js';
import { api } from '../api.js';
import { icon } from '../icons.js';
import { emptyState, skeletonList, walletSummary } from '../components.js';
import { dateTime, money, moneySigned } from '../format.js';

const QUICK_DEPOSITS = [100, 500, 1000];
const QUICK_WITHDRAWALS = [100, 500];

export function walletSkeleton(): RawHtml {
  return h`<div class="view">${skeletonList(1, 'card')}${skeletonList(4, 'row')}</div>`;
}

export async function renderWallet(): Promise<RawHtml> {
  const [wallet, transactions] = await Promise.all([api.wallet(), api.transactions()]);

  const rows =
    transactions.data.length === 0
      ? emptyState('No transactions yet', 'Every balance change writes a ledger entry, and they appear here.')
      : h`<div class="card">${transactions.data.map(
          (transaction) => h`
            <div class="row">
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
      <header class="view-header"><h1 class="view-title">Wallet</h1></header>

      ${walletSummary(
        wallet.data.balanceCents,
        wallet.reconciliation.balanced
          ? 'Simulated funds. Balance reconciles against the full ledger.'
          : 'Ledger mismatch detected — see the developer tools.',
      )}

      <section class="section">
        <h2 class="section-title">Add demo funds</h2>
        <div class="btn-grid">
          ${QUICK_DEPOSITS.map(
            (amount) => h`<button class="btn" type="button" data-deposit="${String(amount * 100)}">
              ${icon('plus', 15)} $${amount}
            </button>`,
          )}
        </div>
        <div style="display:flex;gap:8px">
          <div class="stake-field" style="flex:1">
            <span class="stake-field__prefix">$</span>
            <input type="number" inputmode="decimal" min="5" step="0.01" placeholder="Custom amount"
              data-custom-amount aria-label="Custom amount" />
          </div>
          <button class="btn btn--primary" type="button" data-deposit-custom>Deposit</button>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">Withdraw</h2>
        <p class="dim" style="font-size:12.5px">
          Simulated withdrawal to Demo Account •••• 4821. Nothing leaves KOVR, because there is nothing to send.
        </p>
        <div class="btn-grid">
          ${QUICK_WITHDRAWALS.map(
            (amount) => h`<button class="btn" type="button" data-withdraw="${String(amount * 100)}">
              ${icon('minus', 15)} $${amount}
            </button>`,
          )}
          <button class="btn" type="button" data-withdraw-all>All</button>
        </div>
      </section>

      <section class="section">
        <div class="section__head">
          <h2 class="section-title">Ledger</h2>
          <span class="dim" style="font-size:12px">${transactions.data.length} entries</span>
        </div>
        ${rows}
      </section>
    </div>`;
}

export async function renderActivity(): Promise<RawHtml> {
  const response = await api.activity();

  const body =
    response.data.length === 0
      ? emptyState('Nothing yet', 'Bets, deposits, withdrawals and payouts all appear here.')
      : h`<div class="card">${response.data.map(
          (item) => h`
            <div class="row">
              <span class="row__body">
                <span class="row__title">${item.title}</span>
                <span class="row__meta">${item.detail}</span>
                <span class="row__meta">${dateTime(item.createdAt)}</span>
              </span>
              <span class="row__value">
                <span class="${
                  (item.amountCents ?? 0) >= 0
                    ? 'row__amount row__amount--credit num'
                    : 'row__amount row__amount--debit num'
                }">${item.amountCents === null ? '' : moneySigned(item.amountCents)}</span>
              </span>
            </div>`,
        )}</div>`;

  return h`
    <div class="view">
      <header class="view-header"><h1 class="view-title">Activity</h1></header>
      ${body}
    </div>`;
}
