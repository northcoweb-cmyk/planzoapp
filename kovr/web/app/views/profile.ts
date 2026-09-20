/** Profile, preferences and account information. */

import { h, raw } from '../dom.js';
import type { RawHtml } from '../dom.js';
import { icon } from '../icons.js';
import { skeletonList } from '../components.js';
import { dateTime, money } from '../format.js';
import { preferences } from '../preferences.js';
import { ledger } from '../ledgerClient.js';

export function profileSkeleton(): RawHtml {
  return h`<div class="view">${skeletonList(5, 'row')}</div>`;
}

function linkRow(label: string, meta: string, target: string, iconName: string): RawHtml {
  return h`
    <button class="row row--button" type="button" data-nav="${target}">
      <span class="avatar" aria-hidden="true">${icon(iconName, 16)}</span>
      <span class="row__body">
        <span class="row__title">${label}</span>
        <span class="row__meta">${meta}</span>
      </span>
      ${icon('chevron', 16)}
    </button>`;
}

export async function renderProfile(): Promise<RawHtml> {
  const store = await ledger();
  const [wallet, counts, reconciliation] = await Promise.all([
    store.wallet(),
    store.counts(),
    store.reconcile(),
  ]);
  const settled = counts.WON + counts.LOST + counts.PUSH + counts.VOID + counts.CANCELLED;
  const prefs = preferences();
  const winRate = settled > 0 ? Math.round((counts.WON / settled) * 100) : 0;

  return h`
    <div class="view">
      <header class="view-header fade-up"><h1 class="view-title">Account</h1></header>

      <section class="profile-card fade-up">
        <span class="profile-card__avatar">K</span>
        <span class="profile-card__body">
          <span class="profile-card__name">Your account</span>
          <span class="profile-card__meta">Kept on this device</span>
        </span>
      </section>

      <div class="stat-grid fade-up">
        <div class="stat">
          <span class="stat__value num">${money(wallet.balanceCents)}</span>
          <span class="stat__label">Balance</span>
        </div>
        <div class="stat">
          <span class="stat__value num">${counts.OPEN}</span>
          <span class="stat__label">Open</span>
        </div>
        <div class="stat">
          <span class="stat__value num">${settled === 0 ? '—' : `${winRate}%`}</span>
          <span class="stat__label">Win rate</span>
        </div>
      </div>

      <section class="section fade-up">
        <h2 class="section-title">Account</h2>
        <div class="card">
          ${linkRow('My bets', `${counts.OPEN} open · ${settled} settled`, '/bets', 'bets')}
          ${linkRow('Wallet', money(wallet.balanceCents), '/wallet', 'wallet')}
          ${linkRow('Activity', 'Bets, funding and returns', '/activity', 'activity')}
          ${linkRow('Sports', 'Browse every competition', '/sports', 'sports')}
        </div>
      </section>

      <section class="section fade-up">
        <h2 class="section-title">Preferences</h2>
        <div class="card">
          <label class="row" style="cursor:pointer">
            <span class="row__body">
              <span class="row__title">Auto-accept better odds</span>
              <span class="row__meta">Place without asking when a price moves in your favour. A price
                that moves against you always asks first.</span>
            </span>
            <input class="switch" type="checkbox" data-pref="autoAcceptImprovedOdds"
              ${prefs.autoAcceptImprovedOdds ? raw('checked') : raw('')} />
          </label>
          <label class="row" style="cursor:pointer">
            <span class="row__body">
              <span class="row__title">Alert me when a bet settles</span>
              <span class="row__meta">Shows an in-app alert when an open bet is graded.</span>
            </span>
            <input class="switch" type="checkbox" data-pref="notifyOnSettlement"
              ${prefs.notifyOnSettlement ? raw('checked') : raw('')} />
          </label>
          <div class="row">
            <span class="row__body">
              <span class="row__title">Default stake</span>
              <span class="row__meta">Prefills the betslip.</span>
            </span>
            <span class="stake-field stake-field--inline">
              <span class="stake-field__prefix">$</span>
              <input type="text" inputmode="decimal" placeholder="—" value="${prefs.defaultStake}"
                data-pref-stake aria-label="Default stake" />
            </span>
          </div>
        </div>
      </section>

      <section class="section fade-up">
        <h2 class="section-title">Data</h2>
        <div class="card">
          <div class="row">
            <span class="row__body">
              <span class="row__title">Ledger integrity</span>
              <span class="row__meta">${
                reconciliation.balanced
                  ? `${reconciliation.entries} entries, balanced to the cent`
                  : 'Mismatch between history and balance'
              }</span>
            </span>
            <span class="${reconciliation.balanced ? 'pill pill--won' : 'pill pill--lost'}">
              ${reconciliation.balanced ? 'OK' : 'CHECK'}
            </span>
          </div>
          <div class="row">
            <span class="row__body">
              <span class="row__title">Storage</span>
              <span class="row__meta">
                Your balance, bets and preferences are stored on this device only. No sign-up, no password,
                nothing sent anywhere.
              </span>
            </span>
          </div>
          <button class="row row--button" type="button" data-reset-account>
            <span class="avatar" aria-hidden="true">${icon('refresh', 16)}</span>
            <span class="row__body">
              <span class="row__title">Reset account</span>
              <span class="row__meta">Clears bets and history on this device</span>
            </span>
            ${icon('chevron', 16)}
          </button>
        </div>
      </section>

      <p class="dim view__foot">KOVR · opened ${dateTime(wallet.updatedAt)}</p>
    </div>`;
}
