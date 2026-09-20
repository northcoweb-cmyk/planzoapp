/**
 * Sport and league catalogue rules.
 *
 * KOVR discovers its catalogue from the provider. This file supplies only
 * editorial judgement on top of that discovery — how to group a sport, what
 * to surface first — and never acts as an allow-list. A competition KOVR has
 * never heard of is grouped, ordered last, and shown; it is not dropped.
 */

import type { CategoryId, LeagueId, SeasonState, SportCategory } from './types.js';

/* ───────────────────────────── categories ──────────────────────────── */

const CATEGORY_BY_PROVIDER_GROUP: Readonly<Record<string, SportCategory>> = {
  'Mixed Martial Arts': { id: 'combat', name: 'Combat', priority: 1, icon: 'combat' },
  Boxing: { id: 'combat', name: 'Combat', priority: 1, icon: 'combat' },
  'American Football': { id: 'football', name: 'Football', priority: 2, icon: 'football' },
  Basketball: { id: 'basketball', name: 'Basketball', priority: 3, icon: 'basketball' },
  Baseball: { id: 'baseball', name: 'Baseball', priority: 4, icon: 'baseball' },
  'Ice Hockey': { id: 'hockey', name: 'Hockey', priority: 5, icon: 'hockey' },
  Soccer: { id: 'soccer', name: 'Soccer', priority: 6, icon: 'soccer' },
  Tennis: { id: 'tennis', name: 'Tennis', priority: 7, icon: 'tennis' },
  Golf: { id: 'golf', name: 'Golf', priority: 8, icon: 'golf' },
  'Motor Sport': { id: 'motorsport', name: 'Motorsport', priority: 9, icon: 'motorsport' },
  Cricket: { id: 'cricket', name: 'Cricket', priority: 11, icon: 'cricket' },
  'Rugby League': { id: 'rugby', name: 'Rugby', priority: 12, icon: 'rugby' },
  'Rugby Union': { id: 'rugby', name: 'Rugby', priority: 12, icon: 'rugby' },
  'Aussie Rules': { id: 'aussie-rules', name: 'Aussie Rules', priority: 13, icon: 'generic' },
  Lacrosse: { id: 'lacrosse', name: 'Lacrosse', priority: 14, icon: 'generic' },
  Handball: { id: 'handball', name: 'Handball', priority: 15, icon: 'generic' },
  Volleyball: { id: 'volleyball', name: 'Volleyball', priority: 16, icon: 'generic' },
  Darts: { id: 'darts', name: 'Darts', priority: 17, icon: 'generic' },
  Snooker: { id: 'snooker', name: 'Snooker', priority: 18, icon: 'generic' },
  'Table Tennis': { id: 'table-tennis', name: 'Table Tennis', priority: 19, icon: 'generic' },
  Esports: { id: 'esports', name: 'Esports', priority: 20, icon: 'generic' },
};

/**
 * Provider groups KOVR does not carry. These are not sports, and a sportsbook
 * simulator has no business pricing them.
 */
const EXCLUDED_GROUPS = new Set(['Politics', 'Entertainment', 'Novelty', 'Awards']);

export function isCarriedGroup(group: string): boolean {
  return !EXCLUDED_GROUPS.has(group.trim());
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/**
 * Map a provider group to a KOVR category, inventing a reasonable one for a
 * group we have not seen. Unknown groups sort after every known category but
 * still appear in the navigation.
 */
export function categoryForGroup(group: string): SportCategory {
  const known = CATEGORY_BY_PROVIDER_GROUP[group.trim()];
  if (known) return known;
  return { id: slugify(group) || 'other', name: group.trim() || 'Other', priority: 50, icon: 'generic' };
}

/**
 * Look up a category by the id a League already carries.
 *
 * Preferred over re-deriving from a group name, which would lose the
 * editorial priority that decides where a sport sits in the navigation.
 * An id KOVR has not seen yields a category built from the slug itself.
 */
export function categoryById(id: CategoryId): SportCategory {
  for (const category of Object.values(CATEGORY_BY_PROVIDER_GROUP)) {
    if (category.id === id) return category;
  }
  const name = id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return { id, name: name || 'Other', priority: 50, icon: 'generic' };
}

export function allKnownCategories(): SportCategory[] {
  const seen = new Map<CategoryId, SportCategory>();
  for (const category of Object.values(CATEGORY_BY_PROVIDER_GROUP)) {
    if (!seen.has(category.id)) seen.set(category.id, category);
  }
  return [...seen.values()].sort((a, b) => a.priority - b.priority);
}

/* ─────────────────────────────── leagues ───────────────────────────── */

/**
 * Editorial ordering and short names for the competitions KOVR expects to
 * carry most often. A provider key absent from this table still resolves —
 * it simply sorts last and takes its name from the provider.
 */
const LEAGUE_EDITORIAL: Readonly<Record<string, { id: LeagueId; shortName: string; priority: number }>> = {
  mma_mixed_martial_arts: { id: 'ufc', shortName: 'UFC', priority: 1 },
  boxing_boxing: { id: 'boxing', shortName: 'Boxing', priority: 2 },

  americanfootball_nfl: { id: 'nfl', shortName: 'NFL', priority: 1 },
  americanfootball_ncaaf: { id: 'ncaaf', shortName: 'NCAAF', priority: 2 },
  americanfootball_nfl_super_bowl_winner: { id: 'nfl-futures', shortName: 'NFL Futures', priority: 3 },
  americanfootball_cfl: { id: 'cfl', shortName: 'CFL', priority: 4 },
  americanfootball_ufl: { id: 'ufl', shortName: 'UFL', priority: 5 },

  baseball_mlb: { id: 'mlb', shortName: 'MLB', priority: 1 },
  baseball_mlb_world_series_winner: { id: 'mlb-futures', shortName: 'MLB Futures', priority: 2 },
  baseball_ncaa: { id: 'ncaa-baseball', shortName: 'NCAA', priority: 3 },
  baseball_npb: { id: 'npb', shortName: 'NPB', priority: 4 },
  baseball_kbo: { id: 'kbo', shortName: 'KBO', priority: 5 },

  basketball_nba: { id: 'nba', shortName: 'NBA', priority: 1 },
  basketball_wnba: { id: 'wnba', shortName: 'WNBA', priority: 2 },
  basketball_ncaab: { id: 'ncaab', shortName: 'NCAAB', priority: 3 },
  basketball_wncaab: { id: 'wncaab', shortName: 'W NCAAB', priority: 4 },
  basketball_euroleague: { id: 'euroleague', shortName: 'EuroLeague', priority: 5 },
  basketball_nba_championship_winner: { id: 'nba-futures', shortName: 'NBA Futures', priority: 6 },

  icehockey_nhl: { id: 'nhl', shortName: 'NHL', priority: 1 },
  icehockey_nhl_championship_winner: { id: 'nhl-futures', shortName: 'NHL Futures', priority: 2 },

  soccer_usa_mls: { id: 'mls', shortName: 'MLS', priority: 1 },
  soccer_epl: { id: 'epl', shortName: 'Premier League', priority: 2 },
  soccer_uefa_champs_league: { id: 'ucl', shortName: 'Champions League', priority: 3 },
  soccer_uefa_europa_league: { id: 'uel', shortName: 'Europa League', priority: 4 },
  soccer_uefa_europa_conference_league: { id: 'uecl', shortName: 'Conference League', priority: 5 },
  soccer_spain_la_liga: { id: 'laliga', shortName: 'La Liga', priority: 6 },
  soccer_italy_serie_a: { id: 'serie-a', shortName: 'Serie A', priority: 7 },
  soccer_germany_bundesliga: { id: 'bundesliga', shortName: 'Bundesliga', priority: 8 },
  soccer_france_ligue_one: { id: 'ligue-1', shortName: 'Ligue 1', priority: 9 },
  soccer_mexico_ligamx: { id: 'liga-mx', shortName: 'Liga MX', priority: 10 },
  soccer_efl_champ: { id: 'efl-championship', shortName: 'Championship', priority: 11 },
  soccer_fa_cup: { id: 'fa-cup', shortName: 'FA Cup', priority: 12 },
  soccer_usa_nwsl: { id: 'nwsl', shortName: 'NWSL', priority: 13 },
  soccer_uefa_champs_league_women: { id: 'uwcl', shortName: "Women's UCL", priority: 14 },
  soccer_fifa_world_cup: { id: 'world-cup', shortName: 'World Cup', priority: 15 },

  tennis_atp_aus_open_singles: { id: 'atp-australian-open', shortName: 'AO', priority: 1 },
  tennis_atp_french_open: { id: 'atp-french-open', shortName: 'Roland Garros', priority: 2 },
  tennis_atp_wimbledon: { id: 'atp-wimbledon', shortName: 'Wimbledon', priority: 3 },
  tennis_atp_us_open: { id: 'atp-us-open', shortName: 'US Open', priority: 4 },
  tennis_wta_aus_open_singles: { id: 'wta-australian-open', shortName: 'AO (W)', priority: 5 },
  tennis_wta_french_open: { id: 'wta-french-open', shortName: 'Roland Garros (W)', priority: 6 },
  tennis_wta_wimbledon: { id: 'wta-wimbledon', shortName: 'Wimbledon (W)', priority: 7 },
  tennis_wta_us_open: { id: 'wta-us-open', shortName: 'US Open (W)', priority: 8 },

  golf_masters_tournament_winner: { id: 'masters', shortName: 'The Masters', priority: 1 },
  golf_pga_championship_winner: { id: 'pga-championship', shortName: 'PGA Championship', priority: 2 },
  golf_us_open_winner: { id: 'golf-us-open', shortName: 'U.S. Open', priority: 3 },
  golf_the_open_championship_winner: { id: 'the-open', shortName: 'The Open', priority: 4 },

  motorsport_f1: { id: 'f1', shortName: 'Formula 1', priority: 1 },
  motorsport_nascar_cup: { id: 'nascar', shortName: 'NASCAR', priority: 2 },
  motorsport_indycar: { id: 'indycar', shortName: 'IndyCar', priority: 3 },
};

export interface LeagueEditorial {
  id: LeagueId;
  shortName: string;
  priority: number;
}

/**
 * Resolve KOVR's league identity for a provider key. Unknown keys get a slug
 * derived from the key itself, which is stable across refreshes because the
 * provider key is stable.
 */
export function leagueEditorialFor(providerKey: string, providerTitle: string): LeagueEditorial {
  const known = LEAGUE_EDITORIAL[providerKey];
  if (known) return known;
  return {
    id: slugify(providerKey) || slugify(providerTitle) || 'league',
    shortName: providerTitle.trim() || providerKey,
    priority: 900,
  };
}

/** Leagues KOVR features on the home page when they have current content. */
export const FEATURED_LEAGUE_IDS: readonly LeagueId[] = ['ufc', 'nfl', 'boxing', 'nba', 'mlb', 'nhl', 'epl', 'mls'];

/* ──────────────────────────── season state ─────────────────────────── */

export interface SeasonSignals {
  providerActive: boolean;
  liveEventCount: number;
  upcomingEventCount: number;
  /** True when at least one upcoming event carries a priced market. */
  hasOdds: boolean;
  /** Days until the soonest upcoming event, null when there is none. */
  daysToNextEvent: number | null;
}

/**
 * Derive a league's season state from observed data rather than a calendar.
 *
 * KOVR has no schedule of when seasons start and stop, and does not want one:
 * a hard-coded calendar goes wrong every year. What the provider currently
 * returns is the truth, so the state is read off the events themselves.
 */
export function deriveSeasonState(signals: SeasonSignals): SeasonState {
  const { providerActive, liveEventCount, upcomingEventCount, hasOdds, daysToNextEvent } = signals;

  if (liveEventCount > 0) return 'LIVE';
  if (upcomingEventCount > 0) {
    if (!hasOdds) return 'NO_ODDS_AVAILABLE';
    // Fixtures more than three weeks out read as a season that has not
    // started yet rather than one in progress.
    if (daysToNextEvent !== null && daysToNextEvent > 21) return 'UPCOMING';
    return 'ACTIVE';
  }
  if (!providerActive) return 'OFFSEASON';
  return 'NO_CURRENT_EVENTS';
}

export function seasonStateLabel(state: SeasonState): string {
  switch (state) {
    case 'LIVE':
      return 'Live now';
    case 'ACTIVE':
      return 'In season';
    case 'UPCOMING':
      return 'Season upcoming';
    case 'OFFSEASON':
      return 'Offseason';
    case 'NO_CURRENT_EVENTS':
      return 'No current events';
    case 'NO_ODDS_AVAILABLE':
      return 'Odds unavailable';
    case 'UNKNOWN':
      return 'Unknown';
  }
}

/** Whether a league is worth showing in the main navigation right now. */
export function hasCurrentContent(state: SeasonState): boolean {
  return state === 'LIVE' || state === 'ACTIVE' || state === 'UPCOMING' || state === 'NO_ODDS_AVAILABLE';
}
