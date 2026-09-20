/**
 * HTTP client for The Odds API v4.
 *
 * The API key is read from the environment here and is appended to the query
 * string at the moment of the request. It is never logged, never stored, and
 * never included in an error that could reach the browser — `redactSecrets`
 * scrubs every message on the way out.
 */

import { config, redactSecrets } from '../../config/env.js';
import { ProviderError } from '../SportsDataProvider.js';
import type { RequestLog } from '../../runtime/cache.js';

const BASE_URL = 'https://api.the-odds-api.com/v4';
const REQUEST_TIMEOUT_MS = 12_000;

export interface QuotaHeaders {
  remaining: number | null;
  used: number | null;
  lastCost: number | null;
}

export interface ApiResponse<T> {
  data: T;
  quota: QuotaHeaders;
  fetchedAt: string;
}

function parseHeaderInt(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export class TheOddsApiClient {
  private readonly log: RequestLog;
  private lastSuccessAt: string | null = null;
  private lastErrorAt: string | null = null;
  private lastError: string | null = null;
  private lastQuota: QuotaHeaders = { remaining: null, used: null, lastCost: null };

  constructor(log: RequestLog) {
    this.log = log;
  }

  isConfigured(): boolean {
    return config().oddsApiKey !== null;
  }

  /** Provider calls KOVR has made in the trailing hour. */
  requestsInLastHour(now: number = Date.now()): number {
    return this.log.countSince(new Date(now - 60 * 60 * 1000).toISOString());
  }

  getQuota(): QuotaHeaders {
    return this.lastQuota;
  }

  getLastSuccessAt(): string | null {
    return this.lastSuccessAt;
  }

  getLastErrorAt(): string | null {
    return this.lastErrorAt;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  private logRequest(entry: {
    endpoint: string;
    requestedAt: string;
    durationMs: number;
    status: number | null;
    ok: boolean;
    error: string | null;
    quota: QuotaHeaders;
  }): void {
    this.log.record({
      endpoint: entry.endpoint,
      requestedAt: entry.requestedAt,
      durationMs: entry.durationMs,
      httpStatus: entry.status,
      ok: entry.ok,
      error: entry.error,
      quotaRemaining: entry.quota.remaining,
      quotaUsed: entry.quota.used,
    });
  }

  /**
   * Perform one GET against the provider.
   *
   * `path` and `params` must never contain the key — this method adds it.
   * The endpoint recorded in the request log is the key-free path.
   */
  async get<T>(path: string, params: Record<string, string> = {}): Promise<ApiResponse<T>> {
    const apiKey = config().oddsApiKey;
    if (apiKey === null) {
      throw new ProviderError('NOT_CONFIGURED', 'No odds API key is configured');
    }

    const budget = config().hourlyRequestBudget;
    const used = this.requestsInLastHour();
    if (used >= budget) {
      throw new ProviderError(
        'BUDGET_EXCEEDED',
        `KOVR's hourly provider budget of ${budget} requests is spent (${used} used)`,
      );
    }

    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set('apiKey', apiKey);

    const requestedAt = new Date().toISOString();
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { accept: 'application/json', 'user-agent': 'KOVR-Sports/0.1 (simulator)' },
      });

      const quota: QuotaHeaders = {
        remaining: parseHeaderInt(response.headers.get('x-requests-remaining')),
        used: parseHeaderInt(response.headers.get('x-requests-used')),
        lastCost: parseHeaderInt(response.headers.get('x-requests-last')),
      };
      this.lastQuota = quota;

      if (!response.ok) {
        const body = redactSecrets((await response.text()).slice(0, 400));
        const error = new ProviderError(
          classifyStatus(response.status),
          `Provider responded ${response.status}: ${body}`,
          response.status,
        );
        this.lastErrorAt = new Date().toISOString();
        this.lastError = error.message;
        this.logRequest({
          endpoint: path,
          requestedAt,
          durationMs: Date.now() - started,
          status: response.status,
          ok: false,
          error: error.message,
          quota,
        });
        throw error;
      }

      let data: T;
      try {
        data = (await response.json()) as T;
      } catch (cause) {
        throw new ProviderError(
          'BAD_RESPONSE',
          `Provider returned a body that is not JSON: ${redactSecrets(String(cause))}`,
          response.status,
        );
      }

      const fetchedAt = new Date().toISOString();
      this.lastSuccessAt = fetchedAt;
      this.lastError = null;
      this.logRequest({
        endpoint: path,
        requestedAt,
        durationMs: Date.now() - started,
        status: response.status,
        ok: true,
        error: null,
        quota,
      });
      return { data, quota, fetchedAt };
    } catch (error) {
      if (error instanceof ProviderError) throw error;

      const aborted = error instanceof Error && error.name === 'AbortError';
      const message = aborted
        ? `Provider request timed out after ${REQUEST_TIMEOUT_MS}ms`
        : `Could not reach the provider: ${redactSecrets(error instanceof Error ? error.message : String(error))}`;
      this.lastErrorAt = new Date().toISOString();
      this.lastError = message;
      this.logRequest({
        endpoint: path,
        requestedAt,
        durationMs: Date.now() - started,
        status: null,
        ok: false,
        error: message,
        quota: this.lastQuota,
      });
      throw new ProviderError('NETWORK', message);
    } finally {
      clearTimeout(timer);
    }
  }
}

function classifyStatus(status: number): ProviderError['code'] {
  if (status === 401 || status === 403) return 'AUTH_FAILED';
  if (status === 404) return 'NOT_FOUND';
  if (status === 422) return 'BAD_RESPONSE';
  if (status === 429) return 'RATE_LIMITED';
  return 'BAD_RESPONSE';
}
