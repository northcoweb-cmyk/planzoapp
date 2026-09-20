/**
 * The Odds API v4 wire shapes and their validators.
 *
 * This is the only file in KOVR that describes a vendor's response format.
 * Everything here is treated as untrusted input: a record that does not match
 * is dropped, never coerced. A dropped record shows up as missing data, which
 * the UI reports honestly; a coerced one would show up as a wrong price.
 */

export interface RawSport {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

export interface RawOutcome {
  name: string;
  price: number;
  point?: number;
  description?: string;
}

export interface RawMarket {
  key: string;
  last_update?: string;
  outcomes: RawOutcome[];
}

export interface RawBookmaker {
  key: string;
  title: string;
  last_update?: string;
  markets: RawMarket[];
}

export interface RawEvent {
  id: string;
  sport_key: string;
  sport_title?: string;
  commence_time: string;
  home_team?: string | null;
  away_team?: string | null;
  bookmakers?: RawBookmaker[];
}

export interface RawScore {
  name: string;
  score: string | number | null;
}

export interface RawScoreEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  completed: boolean;
  home_team?: string | null;
  away_team?: string | null;
  scores?: RawScore[] | null;
  last_update?: string | null;
}

/* ───────────────────────────── validators ──────────────────────────── */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** An ISO timestamp the runtime can actually parse. */
function isTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value));
}

export function isRawSport(value: unknown): value is RawSport {
  return (
    isObject(value) &&
    isNonEmptyString(value['key']) &&
    isNonEmptyString(value['title']) &&
    typeof value['active'] === 'boolean'
  );
}

export function isRawOutcome(value: unknown): value is RawOutcome {
  return (
    isObject(value) &&
    isNonEmptyString(value['name']) &&
    typeof value['price'] === 'number' &&
    Number.isFinite(value['price']) &&
    (value['point'] === undefined || typeof value['point'] === 'number')
  );
}

export function isRawMarket(value: unknown): value is RawMarket {
  return isObject(value) && isNonEmptyString(value['key']) && Array.isArray(value['outcomes']);
}

export function isRawBookmaker(value: unknown): value is RawBookmaker {
  return (
    isObject(value) &&
    isNonEmptyString(value['key']) &&
    isNonEmptyString(value['title']) &&
    Array.isArray(value['markets'])
  );
}

export function isRawEvent(value: unknown): value is RawEvent {
  return (
    isObject(value) &&
    isNonEmptyString(value['id']) &&
    isNonEmptyString(value['sport_key']) &&
    isTimestamp(value['commence_time'])
  );
}

export function isRawScoreEvent(value: unknown): value is RawScoreEvent {
  return (
    isObject(value) &&
    isNonEmptyString(value['id']) &&
    isTimestamp(value['commence_time']) &&
    typeof value['completed'] === 'boolean'
  );
}

/** Keep only the array members that validate; drop the rest silently. */
export function filterValid<T>(value: unknown, guard: (item: unknown) => item is T): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter(guard);
}
