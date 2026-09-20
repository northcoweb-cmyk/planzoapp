/** Profile, preferences and the plain statement of what KOVR is. */

import { h, raw } from '../dom.js';
import type { RawHtml } from '../dom.js';
import { api } from '../api.js';
import { icon } from '../icons.js';
import { skeletonList } from '../components.js';
import { dateTime, money } from '../format.js';
import { store } from '../store.js';
import { preferences } from '../preferences.js';

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
  const response = await api.profile();
  const profile = response.data;
  const settled =
    profile.counts.WON + profile.counts.LOST + profile.counts.PUSH + profile.counts.VOID + profile.counts.CANCELLED;
  const adminEnabled = store.get().config?.adminEnabled === true;
  const prefs = preferences();

  return h`
    <div class="view">
      <header class="view-header"><h1 class="view-title">Profile</h1></header>

      <section class="card" style="padding:18px;display:flex;align-items:center;gap:14px">
        <span class="avatar avatar--round" style="width:54px;height:54px;font-size:17px">${profile.initials}</span>
        <span style="flex:1;min-width:0">
          <span style="display:block;font-size:17px;font-weight:700;letter-spacing:-0.02em">${profile.displayName}</span>
          <span style="display:block;font-size:13px" class="muted">@${profile.username}</span>
          <span style="display:block;font-size:12px" class="dim">${profile.email}</span>
        </span>
      </section>

      <div class="stat-grid">
        <div class="stat">
          <span class="stat__value num">${money(profile.wallet.balanceCents)}</span>
          <span class="stat__label">Balance</span>
        </div>
        <div class="stat">
          <span class="stat__value num">${profile.counts.OPEN}</span>
          <span class="stat__label">Open</span>
        </div>
        <div class="stat">
          <span class="stat__value num">${profile.counts.WON}/${settled}</span>
          <span class="stat__label">Won</span>
        </div>
      </div>

      <section class="section">
        <h2 class="section-title">Account</h2>
        <div class="card">
          ${linkRow('My bets', `${profile.counts.OPEN} open · ${settled} settled`, '/bets', 'bets')}
          ${linkRow('Wallet', money(profile.wallet.balanceCents), '/wallet', 'wallet')}
          ${linkRow('Activity', 'Deposits, bets, payouts', '/activity', 'activity')}
          ${linkRow('Sports', 'Browse every competition', '/sports', 'sports')}
          ${adminEnabled ? linkRow('Developer tools', 'Provider status and demo controls', '/admin', 'tools') : raw('')}
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">Preferences</h2>
        <div class="card">
          <label class="row" style="cursor:pointer">
            <span class="row__body">
              <span class="row__title">Auto-accept improved odds</span>
              <span class="row__meta">Place without prompting when a price moves in your favour. A price
                that moves against you always asks first.</span>
            </span>
            <input class="switch" type="checkbox" data-pref="autoAcceptImprovedOdds"
              ${prefs.autoAcceptImprovedOdds ? raw('checked') : raw('')} />
          </label>
          <label class="row" style="cursor:pointer">
            <span class="row__body">
              <span class="row__title">Alert me when a bet settles</span>
              <span class="row__meta">Shows an in-app alert. KOVR has no account to push to, so it does
                not ask for notification permission it could not honour.</span>
            </span>
            <input class="switch" type="checkbox" data-pref="notifyOnSettlement"
              ${prefs.notifyOnSettlement ? raw('checked') : raw('')} />
          </label>
          <div class="row">
            <span class="row__body">
              <span class="row__title">Default stake</span>
              <span class="row__meta">Prefills the betslip. Leave blank for none.</span>
            </span>
            <span class="stake-field" style="width:120px;height:38px">
              <span class="stake-field__prefix" style="font-size:14px">$</span>
              <input type="text" inputmode="decimal" placeholder="—" value="${prefs.defaultStake}"
                data-pref-stake aria-label="Default stake" style="font-size:15px" />
            </span>
          </div>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">Security and data</h2>
        <div class="card" style="padding:16px;display:flex;gap:11px;align-items:flex-start">
          ${icon('shield', 18)}
          <div>
            <p style="font-weight:700;font-size:14px">There is no account to secure</p>
            <p class="muted" style="font-size:13px;margin-top:3px">
              KOVR has no sign-up, no password and no session. It stores a single local demo profile,
              its simulated ledger, and your betslip and preferences in this browser. It collects no
              personal data, contacts no payment provider, and sends nothing about you anywhere.
            </p>
          </div>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">About this app</h2>
        <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px">
          <div style="display:flex;gap:11px;align-items:flex-start">
            ${icon('shield', 18)}
            <div>
              <p style="font-weight:700;font-size:14px">Simulator — no real money</p>
              <p class="muted" style="font-size:13px;margin-top:3px">
                Every balance, stake and payout in KOVR is a demo value. No payment is processed, no bank or
                card detail is requested, and nothing here can be withdrawn to a real account.
              </p>
            </div>
          </div>
          <div style="display:flex;gap:11px;align-items:flex-start">
            ${icon('clock', 18)}
            <div>
              <p style="font-weight:700;font-size:14px">Real sports data</p>
              <p class="muted" style="font-size:13px;margin-top:3px">
                Events, competitors, prices and results come from a live sports data provider. When that
                provider is unreachable KOVR says so rather than inventing an event or a price.
              </p>
            </div>
          </div>
          <p class="dim" style="font-size:12px">Demo account created ${dateTime(profile.createdAt)}</p>
        </div>
      </section>
    </div>`;
}
