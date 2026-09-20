/**
 * Presentation formatting.
 *
 * Money and odds arrive from the server already computed — the browser never
 * decides what a bet pays. These helpers only decide how it reads.
 */

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function money(cents: number): string {
  return MONEY.format(cents / 100);
}

export function moneySigned(cents: number): string {
  const body = MONEY.format(Math.abs(cents) / 100);
  return cents < 0 ? `-${body}` : `+${body}`;
}

/** "-110" / "+125" — always explicitly signed, the way a board shows it. */
export function odds(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

/** "+3.5" / "-7" / "o47.5" — the handicap or total attached to a selection. */
export function line(value: number | null, marketKey: string): string {
  if (value === null) return '';
  if (marketKey.includes('total')) return String(value);
  return value > 0 ? `+${value}` : String(value);
}

const DAY = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const TIME = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

/** "Today 8:00 PM", "Sat, Sep 27 6:30 PM" — local to the viewer. */
export function eventTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';

  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now.getTime() + 86_400_000).toDateString() === date.toDateString();

  if (sameDay) return `Today ${TIME.format(date)}`;
  if (tomorrow) return `Tomorrow ${TIME.format(date)}`;
  return `${DAY.format(date)} ${TIME.format(date)}`;
}

export function shortTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : TIME.format(date);
}

export function dateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : `${DAY.format(date)} · ${TIME.format(date)}`;
}

/**
 * Time until an event starts, as a scoreboard would show it: "2h 14m",
 * "18m", "Starting now". Falls back to the date when it is days away.
 */
export function countdown(iso: string, now = Date.now()): string {
  const start = Date.parse(iso);
  if (!Number.isFinite(start)) return 'Time unavailable';

  const deltaMs = start - now;
  if (deltaMs <= 0) return 'Starting now';

  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return 'Under a minute';
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remainder = minutes % 60;
    return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
  }
  return eventTime(iso);
}

/** "just now", "4m ago", "2h ago" — used for the freshness label. */
export function relativeAge(ms: number | null): string {
  if (ms === null) return 'unknown';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 15) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** "Israel Adesanya" -> "IA". Typographic only; it identifies nobody. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return (words[0] ?? '').slice(0, 2).toUpperCase();
  return `${(words[0] ?? '').charAt(0)}${(words[words.length - 1] ?? '').charAt(0)}`.toUpperCase();
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}
