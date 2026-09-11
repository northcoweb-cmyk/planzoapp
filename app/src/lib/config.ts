/**
 * Runtime configuration.
 *
 * Keys are NEVER baked into the single-file build except Ticketmaster, which
 * is a free, rate-limited, non-billable tier. Google Places and OpenAI can
 * both cost real money and a key inside a downloadable file cannot be
 * restricted by referrer, so those two are proxied through the Planzo
 * server (which holds them in its own env) whenever this app is served BY
 * that server — i.e. every normal build. `hasServer` is false only for the
 * standalone single-file download, which has no backend to call and falls
 * back to a key the user pastes into Settings on their own device.
 */
declare const __SINGLE_FILE__: boolean;
export const hasServer = !__SINGLE_FILE__;
export type Cfg = {
  ticketmaster: string;
  places: string;
  openai: string;
  serverUrl: string;
  adminKey: string;
};

const TM_PUBLIC = '3qecKAYV9zfTz8cuTesocN7W4TW9bJpG';
const LS = 'planzo.cfg.v1';

function fromStorage(): Partial<Cfg> {
  try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; }
}

let cfg: Cfg = {
  ticketmaster: TM_PUBLIC,
  places: '',
  openai: '',
  serverUrl: '',
  adminKey: '',
  ...fromStorage(),
};

export const config = {
  get: () => cfg,
  set(patch: Partial<Cfg>) {
    cfg = { ...cfg, ...patch };
    try { localStorage.setItem(LS, JSON.stringify(patch)); } catch {}
  },
  has: (k: keyof Cfg) => Boolean(cfg[k]),
};

/** A hard client-side call budget so a demo file can never run a bill up. */
const BUDGET_KEY = 'planzo.budget.v1';
const DAILY_CAPS = { places: 60, openai: 120 } as const;

export function spendGuard(service: keyof typeof DAILY_CAPS): boolean {
  const day = new Date().toISOString().slice(0, 10);
  let ledger: Record<string, number> = {};
  try { ledger = JSON.parse(localStorage.getItem(BUDGET_KEY) || '{}'); } catch {}
  if (ledger.day !== (day as any)) ledger = { day: day as any };
  const used = Number(ledger[service]) || 0;
  if (used >= DAILY_CAPS[service]) return false;
  ledger[service] = used + 1;
  try { localStorage.setItem(BUDGET_KEY, JSON.stringify(ledger)); } catch {}
  return true;
}

export function spendUsed() {
  const day = new Date().toISOString().slice(0, 10);
  let l: any = {};
  try { l = JSON.parse(localStorage.getItem(BUDGET_KEY) || '{}'); } catch {}
  if (l.day !== day) l = {};
  return {
    places: { used: Number(l.places) || 0, cap: DAILY_CAPS.places },
    openai: { used: Number(l.openai) || 0, cap: DAILY_CAPS.openai },
  };
}
