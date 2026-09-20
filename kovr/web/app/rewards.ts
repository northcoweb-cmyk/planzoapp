/**
 * Rewards.
 *
 * Points and tier are derived from the ledger's own transaction history —
 * lifetime amount wagered — rather than kept as a separate counter. A
 * separate counter can drift from what actually happened; a derived value
 * cannot, the same reason the wallet balance itself is never assigned
 * directly.
 *
 * This is a loyalty-tier *concept* built entirely on KOVR's own simulated
 * ledger. It grants nothing real and requires no backend authorization,
 * because nothing it touches is real money.
 */

import type { WalletTransaction } from '../../src/domain/types.js';

export type Tier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface RewardsSummary {
  tier: Tier;
  points: number;
  lifetimeWageredCents: number;
  nextTier: Tier | null;
  pointsForNextTier: number | null;
  /** 0–1 progress through the current tier's band. */
  progress: number;
}

/** Points earned per dollar wagered — placed, win or lose. */
const POINTS_PER_DOLLAR = 10;

const TIERS: ReadonlyArray<{ name: Tier; threshold: number }> = [
  { name: 'Bronze', threshold: 0 },
  { name: 'Silver', threshold: 5_000 },
  { name: 'Gold', threshold: 20_000 },
  { name: 'Platinum', threshold: 60_000 },
];

export function computeRewards(transactions: readonly WalletTransaction[]): RewardsSummary {
  const lifetimeWageredCents = transactions
    .filter((transaction) => transaction.type === 'BET_PLACED')
    .reduce((sum, transaction) => sum + Math.abs(transaction.amountCents), 0);

  const points = Math.floor((lifetimeWageredCents / 100) * POINTS_PER_DOLLAR);

  let current = TIERS[0];
  let next: (typeof TIERS)[number] | null = null;
  for (let i = 0; i < TIERS.length; i++) {
    const tier = TIERS[i];
    if (tier && points >= tier.threshold) {
      current = tier;
      next = TIERS[i + 1] ?? null;
    }
  }

  const bandStart = current?.threshold ?? 0;
  const bandEnd = next?.threshold ?? bandStart;
  const progress = next === null ? 1 : Math.min(1, Math.max(0, (points - bandStart) / (bandEnd - bandStart)));

  return {
    tier: current?.name ?? 'Bronze',
    points,
    lifetimeWageredCents,
    nextTier: next?.name ?? null,
    pointsForNextTier: next ? next.threshold - points : null,
    progress,
  };
}

export function tierColor(tier: Tier): string {
  switch (tier) {
    case 'Bronze':
      return '#C48A5A';
    case 'Silver':
      return '#C3CAD6';
    case 'Gold':
      return '#F2C14E';
    case 'Platinum':
      return '#E7E9FF';
  }
}
