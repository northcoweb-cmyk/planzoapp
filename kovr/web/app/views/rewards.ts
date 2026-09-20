/**
 * Rewards.
 *
 * Tier and points are computed from lifetime stake volume in the ledger's
 * own transaction history — see rewards.ts. Nothing here is a separate
 * balance that could drift from what was actually wagered.
 */

import { h, raw } from '../dom.js';
import type { RawHtml } from '../dom.js';
import { icon } from '../icons.js';
import { skeletonList, emptyState } from '../components.js';
import { money } from '../format.js';
import { store } from '../store.js';
import { tierColor } from '../rewards.js';
import type { Tier } from '../rewards.js';

export function rewardsSkeleton(): RawHtml {
  return h`<div class="view"><div class="skeleton skeleton--hero"></div>${skeletonList(3, 'row')}</div>`;
}

const TIER_ORDER: Tier[] = ['Bronze', 'Silver', 'Gold', 'Platinum'];

const TIER_PERKS: Record<Tier, string[]> = {
  Bronze: ['Points on every wager', 'Access to all promotions'],
  Silver: ['5% faster settlement alerts', 'Silver-only promotions'],
  Gold: ['Priority support', 'Gold-only promotions', 'Higher stake limits available'],
  Platinum: ['All Gold perks', 'Platinum-only promotions', 'Dedicated support channel'],
};

function tierBadge(tier: Tier, size = 64): RawHtml {
  const color = tierColor(tier);
  return h`
    <span class="tier-badge" style="width:${size}px;height:${size}px;--tier-color:${color}">
      ${icon('crown', Math.round(size * 0.42))}
    </span>`;
}

export async function renderRewards(): Promise<RawHtml> {
  const summary = await store.refreshRewards();

  const ladder = TIER_ORDER.map((tier) => {
    const reached = TIER_ORDER.indexOf(tier) <= TIER_ORDER.indexOf(summary.tier);
    return h`
      <div class="${reached ? 'tier-step tier-step--reached' : 'tier-step'}">
        ${tierBadge(tier, 40)}
        <span class="tier-step__name">${tier}</span>
      </div>`;
  });

  return h`
    <div class="view">
      <header class="view-header fade-up"><h1 class="view-title">Rewards</h1></header>

      <section class="rewards-hero fade-up" style="--tier-color:${tierColor(summary.tier)}">
        <div class="rewards-hero__glow" aria-hidden="true"></div>
        ${tierBadge(summary.tier, 68)}
        <p class="rewards-hero__tier">${summary.tier} tier</p>
        <p class="rewards-hero__points num">${summary.points.toLocaleString('en-US')} pts</p>
        ${
          summary.nextTier
            ? h`
              <div class="rewards-progress">
                <div class="rewards-progress__track">
                  <div class="rewards-progress__fill" style="width:${Math.round(summary.progress * 100)}%"></div>
                </div>
                <p class="rewards-progress__label">
                  ${(summary.pointsForNextTier ?? 0).toLocaleString('en-US')} pts to ${summary.nextTier}
                </p>
              </div>`
            : h`<p class="rewards-progress__label">Highest tier reached</p>`
        }
      </section>

      <section class="section fade-up">
        <h2 class="section-title">Tier ladder</h2>
        <div class="tier-ladder">${ladder}</div>
      </section>

      <section class="section fade-up">
        <div class="section__head">
          <h2 class="section-title">${summary.tier} perks</h2>
        </div>
        <div class="card">
          ${TIER_PERKS[summary.tier].map(
            (perk) => h`
              <div class="row">
                <span class="avatar" aria-hidden="true">${icon('check', 15)}</span>
                <span class="row__body"><span class="row__title">${perk}</span></span>
              </div>`,
          )}
        </div>
      </section>

      <section class="section fade-up">
        <h2 class="section-title">How it works</h2>
        <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px">
          <p class="muted">Every dollar wagered earns 10 points, win or lose — placing the bet is what
            counts, not the outcome.</p>
          <p class="muted">Lifetime wagered so far: <strong class="num">${money(summary.lifetimeWageredCents)}</strong></p>
        </div>
      </section>

      ${
        summary.points === 0
          ? emptyState('Place your first bet to start earning', 'Points accrue automatically — nothing to claim.', 'rewards')
          : raw('')
      }
    </div>`;
}
