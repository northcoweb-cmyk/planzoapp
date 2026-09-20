/**
 * Viewer preferences.
 *
 * Kept per-browser in localStorage: there is no account here to attach them
 * to, and pretending otherwise would be a lie about what KOVR stores. Every
 * preference below changes real behaviour — none is decorative.
 */

export interface Preferences {
  /**
   * Place without prompting when the market has moved *in the bettor's
   * favour*. A price that moved against them always prompts, whatever this
   * is set to — that is the whole point of the confirmation.
   */
  autoAcceptImprovedOdds: boolean;
  /** Prefills the betslip stake field. Empty means no default. */
  defaultStake: string;
  /** Raise an in-app alert when an open bet settles. */
  notifyOnSettlement: boolean;
}

const KEY = 'kovr.preferences.v1';

const DEFAULTS: Preferences = {
  autoAcceptImprovedOdds: false,
  defaultStake: '',
  notifyOnSettlement: true,
};

let cached: Preferences | null = null;

export function preferences(): Preferences {
  if (cached) return cached;
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (typeof parsed === 'object' && parsed !== null) {
        const record = parsed as Partial<Preferences>;
        cached = {
          autoAcceptImprovedOdds: record.autoAcceptImprovedOdds === true,
          defaultStake: typeof record.defaultStake === 'string' ? record.defaultStake : '',
          notifyOnSettlement: record.notifyOnSettlement !== false,
        };
        return cached;
      }
    }
  } catch {
    // Storage may be unavailable; the defaults are perfectly usable.
  }
  cached = { ...DEFAULTS };
  return cached;
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): Preferences {
  const next = { ...preferences(), [key]: value };
  cached = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // A preference that cannot be persisted still applies for this session.
  }
  return next;
}
