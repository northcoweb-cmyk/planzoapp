/**
 * Promotions.
 *
 * Every card either does exactly what it says or is plainly informational
 * with no claim button — never a button that looks actionable but isn't.
 * The one functional promotion (a welcome deposit boost) operates entirely
 * within KOVR's own simulated ledger: it credits simulated funds on top of
 * a simulated deposit, the same kind of operation the wallet already does.
 */

import { h } from '../dom.js';
import type { RawHtml } from '../dom.js';
import { icon } from '../icons.js';
import { skeletonList } from '../components.js';
import { preferences } from '../preferences.js';
import { store } from '../store.js';

export function promotionsSkeleton(): RawHtml {
  return h`<div class="view">${skeletonList(3, 'card')}</div>`;
}

export async function renderPromotions(): Promise<RawHtml> {
  const prefs = preferences();
  const rewards = store.get().rewards;

  const welcomeCard = h`
    <article class="promo-card fade-up">
      <div class="promo-card__badge">${icon('gift', 15)} Deposit boost</div>
      <h3 class="promo-card__title">Get 20% extra on your next deposit</h3>
      <p class="promo-card__body">
        Claim it here, then make a deposit from Wallet — KOVR adds 20% more in simulated funds on top,
        up to $200 bonus. One-time, applies automatically to your next deposit only.
      </p>
      <div class="promo-card__meta">
        <span>${icon('clock', 13)} No expiration</span>
        <span>${icon('check', 13)} Applies automatically</span>
      </div>
      ${
        prefs.welcomeBoostState === 'used'
          ? h`<div class="promo-card__status promo-card__status--done">${icon('check', 14)} Already used</div>`
          : prefs.welcomeBoostState === 'claimed'
            ? h`<div class="promo-card__status">${icon('check', 14)} Claimed — make a deposit to apply it</div>`
            : h`<button class="btn btn--primary btn--block" type="button" data-claim-welcome-boost>Claim</button>`
      }
    </article>`;

  const rewardsCard = h`
    <article class="promo-card fade-up" style="animation-delay:60ms">
      <div class="promo-card__badge">${icon('rewards', 15)} Rewards</div>
      <h3 class="promo-card__title">${rewards ? `${rewards.tier} tier` : 'Earn points on every bet'}</h3>
      <p class="promo-card__body">
        Every dollar wagered earns 10 points automatically. Higher tiers unlock more perks — no opt-in
        needed.
      </p>
      <button class="btn btn--block" type="button" data-nav="/rewards">View rewards</button>
    </article>`;

  return h`
    <div class="view">
      <header class="view-header fade-up"><h1 class="view-title">Promotions</h1></header>
      <p class="muted fade-up">All simulated funds. Nothing here processes a real payment.</p>
      <div class="promo-list">
        ${welcomeCard}
        ${rewardsCard}
      </div>
    </div>`;
}
