/**
 * Market normalisation.
 *
 * KOVR displays whatever markets the provider actually returns. Known keys
 * get an editorial name and ordering; anything unrecognised is humanised from
 * its key and still shown, so a newly offered market needs no code change.
 * Nothing here ever invents a market the provider did not supply.
 */

import type { MarketKind } from './types.js';

interface MarketDefinition {
  name: string;
  kind: MarketKind;
  /** Lower sorts first within an event. */
  priority: number;
}

const KNOWN: Readonly<Record<string, MarketDefinition>> = {
  h2h: { name: 'Moneyline', kind: 'MONEYLINE', priority: 10 },
  h2h_lay: { name: 'Moneyline (Lay)', kind: 'MONEYLINE', priority: 11 },
  h2h_3_way: { name: 'Match Result (3-Way)', kind: 'MONEYLINE', priority: 12 },
  spreads: { name: 'Spread', kind: 'SPREAD', priority: 20 },
  totals: { name: 'Total', kind: 'TOTAL', priority: 30 },
  outrights: { name: 'Outright Winner', kind: 'OUTRIGHT', priority: 40 },
  outrights_lay: { name: 'Outright (Lay)', kind: 'OUTRIGHT', priority: 41 },
  alternate_spreads: { name: 'Alternate Spreads', kind: 'SPREAD', priority: 21 },
  alternate_totals: { name: 'Alternate Totals', kind: 'TOTAL', priority: 31 },
  btts: { name: 'Both Teams To Score', kind: 'TEAM_PROP', priority: 50 },
  draw_no_bet: { name: 'Draw No Bet', kind: 'MONEYLINE', priority: 13 },
  double_chance: { name: 'Double Chance', kind: 'MONEYLINE', priority: 14 },
  team_totals: { name: 'Team Totals', kind: 'TEAM_PROP', priority: 51 },
};

/** Provider key prefixes that identify a family without listing every key. */
const PREFIX_RULES: ReadonlyArray<{ prefix: string; kind: MarketKind; priority: number }> = [
  { prefix: 'player_', kind: 'PLAYER_PROP', priority: 70 },
  { prefix: 'batter_', kind: 'PLAYER_PROP', priority: 71 },
  { prefix: 'pitcher_', kind: 'PLAYER_PROP', priority: 72 },
  { prefix: 'team_', kind: 'TEAM_PROP', priority: 60 },
  { prefix: 'h2h_q', kind: 'PERIOD', priority: 80 },
  { prefix: 'h2h_h', kind: 'PERIOD', priority: 81 },
  { prefix: 'h2h_p', kind: 'PERIOD', priority: 82 },
  { prefix: 'spreads_q', kind: 'PERIOD', priority: 83 },
  { prefix: 'spreads_h', kind: 'PERIOD', priority: 84 },
  { prefix: 'totals_q', kind: 'PERIOD', priority: 85 },
  { prefix: 'totals_h', kind: 'PERIOD', priority: 86 },
  { prefix: 'alternate_', kind: 'OTHER', priority: 90 },
];

/** `player_pass_tds` -> `Player Pass Tds`. Readable without a lookup table. */
function humaniseKey(key: string): string {
  return key
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function describeMarket(key: string): MarketDefinition {
  const known = KNOWN[key];
  if (known) return known;

  for (const rule of PREFIX_RULES) {
    if (key.startsWith(rule.prefix)) {
      return { name: humaniseKey(key), kind: rule.kind, priority: rule.priority };
    }
  }
  return { name: humaniseKey(key), kind: 'OTHER', priority: 100 };
}

/** The markets KOVR requests by default. Kept small to respect rate limits. */
export const CORE_MARKET_KEYS = ['h2h', 'spreads', 'totals'] as const;

/**
 * A moneyline-style market can be graded from a winner alone. Spreads and
 * totals need scores, which not every provider publishes for every sport —
 * the settlement engine checks this before attempting to grade.
 */
export function gradableFromWinnerOnly(kind: MarketKind): boolean {
  return kind === 'MONEYLINE' || kind === 'OUTRIGHT';
}
