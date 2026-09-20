/**
 * Environment configuration.
 *
 * Secrets live in the environment and nowhere else: not in source, not in
 * git, and never in anything the browser can reach. `publicConfig()` is the
 * only shape that crosses to the client, and it carries no key.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fromRoot } from './paths.js';

/** Minimal dotenv parser — KOVR ships with no runtime dependencies. */
function parseEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

let loaded = false;

/**
 * Load `.env.local` then `.env` into `process.env` without overwriting values
 * already set by the real environment, which always wins.
 */
export function loadEnvFiles(): void {
  if (loaded) return;
  loaded = true;
  for (const name of ['.env.local', '.env']) {
    const path = fromRoot(name);
    if (!existsSync(path)) continue;
    for (const [key, value] of Object.entries(parseEnvFile(readFileSync(path, 'utf8')))) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

function str(key: string, fallback: string): string {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : value;
}

function int(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

export interface KovrConfig {
  readonly port: number;
  readonly host: string;
  readonly dbPath: string;
  readonly oddsApiKey: string | null;
  readonly oddsRegions: string;
  readonly preferredBookmaker: string | null;
  readonly hourlyRequestBudget: number;
  readonly demoStartingBalanceCents: number;
  readonly adminEnabled: boolean;
  readonly nodeEnv: string;
}

let cached: KovrConfig | null = null;

export function config(): KovrConfig {
  if (cached) return cached;
  loadEnvFiles();

  const key = str('KOVR_ODDS_API_KEY', '').trim();
  cached = {
    port: int('KOVR_PORT', 4300),
    host: str('KOVR_HOST', '127.0.0.1'),
    dbPath: fromRoot(str('KOVR_DB_PATH', 'data/kovr.db')),
    // An unset key is a supported state: KOVR reports the data as
    // unavailable rather than inventing events to fill the screen.
    oddsApiKey: key === '' ? null : key,
    oddsRegions: str('KOVR_ODDS_REGIONS', 'us'),
    preferredBookmaker: str('KOVR_ODDS_PREFERRED_BOOKMAKER', '').trim() || null,
    hourlyRequestBudget: Math.max(1, int('KOVR_ODDS_HOURLY_BUDGET', 180)),
    demoStartingBalanceCents: Math.max(0, int('KOVR_DEMO_STARTING_BALANCE', 10_000)) * 100,
    adminEnabled: bool('KOVR_ADMIN_ENABLED', false),
    nodeEnv: str('NODE_ENV', 'development'),
  };
  return cached;
}

/** Test helper: forget the memoised config so a new environment takes effect. */
export function resetConfigCache(): void {
  cached = null;
  loaded = false;
}

/**
 * The only configuration shape sent to the browser. Deliberately contains no
 * key, no secret, and nothing that could be used to call the provider directly.
 */
export interface PublicConfig {
  providerConfigured: boolean;
  demoStartingBalanceCents: number;
  adminEnabled: boolean;
}

export function publicConfig(): PublicConfig {
  const c = config();
  return {
    providerConfigured: c.oddsApiKey !== null,
    demoStartingBalanceCents: c.demoStartingBalanceCents,
    adminEnabled: c.adminEnabled,
  };
}

/**
 * Redact anything that looks like the API key from a string bound for a log,
 * an error message or an HTTP response.
 */
export function redactSecrets(text: string): string {
  const key = config().oddsApiKey;
  let out = text;
  if (key) out = out.split(key).join('[redacted]');
  return out.replace(/([?&](?:apiKey|api_key|key)=)[^&\s"']+/gi, '$1[redacted]');
}
