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
  /**
   * A self-set cap on any single stake, in cents. 0 means no cap. Enforced
   * at placement — this is a real limit, not a decorative number.
   */
  maxStakeCents: number;
  /**
   * When set and in the future, betting and deposits are blocked until this
   * ISO timestamp. A real, locally-enforced cool-off: once set, nothing in
   * the UI offers a way to shorten or cancel it before it lapses.
   */
  selfExcludedUntil: string | null;
  /**
   * The welcome deposit boost, tracked through its own lifecycle so it can
   * be claimed once and applied exactly once. See promotions.ts.
   */
  welcomeBoostState: 'unclaimed' | 'claimed' | 'used';
}

const KEY = 'kovr.preferences.v1';

const DEFAULTS: Preferences = {
  autoAcceptImprovedOdds: false,
  defaultStake: '',
  notifyOnSettlement: true,
  maxStakeCents: 0,
  selfExcludedUntil: null,
  welcomeBoostState: 'unclaimed',
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
          maxStakeCents:
            typeof record.maxStakeCents === 'number' && Number.isFinite(record.maxStakeCents) && record.maxStakeCents >= 0
              ? record.maxStakeCents
              : 0,
          selfExcludedUntil: typeof record.selfExcludedUntil === 'string' ? record.selfExcludedUntil : null,
          welcomeBoostState:
            record.welcomeBoostState === 'claimed' || record.welcomeBoostState === 'used'
              ? record.welcomeBoostState
              : 'unclaimed',
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

/** Whether a cool-off is currently in effect, and until when. */
export function selfExclusionStatus(now = Date.now()): { active: boolean; until: string | null } {
  const until = preferences().selfExcludedUntil;
  if (!until) return { active: false, until: null };
  return { active: Date.parse(until) > now, until };
}

/**
 * Start a cool-off for the given number of hours from now. There is no
 * corresponding "cancel" — once set, nothing in the UI can shorten it,
 * which is the point of a real cool-off rather than a decorative one.
 */
export function setExclusion(hours: number): Preferences {
  const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  return setPreference('selfExcludedUntil', until);
}
