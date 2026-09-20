/**
 * The one place KOVR talks to a data provider.
 *
 * Every sports read goes through `load()`, which gives three things the UI
 * depends on and the provider's rate limit requires:
 *
 *   deduplication — concurrent callers asking for the same key share a single
 *                   in-flight request instead of each firing their own;
 *   caching       — a fresh entry is served without a network call at all,
 *                   and a stale one is served, clearly labelled, when the
 *                   provider is unreachable;
 *   honesty       — a failure with no usable cache returns `unavailable` and
 *                   null data. It never returns something made up.
 */

import type { DataSource, Freshness } from '../domain/types.js';
import type { FreshnessClass } from '../domain/status.js';
import { buildFreshness } from '../domain/status.js';
import { ProviderError } from '../providers/SportsDataProvider.js';
import { redactSecrets } from '../config/env.js';
import type { MetaRepository } from '../store/repositories/metaRepo.js';

/** How long a cached payload stays authoritative, by data class. */
export const CACHE_TTL_MS = {
  catalog: 6 * 60 * 60 * 1000,
  schedule: 10 * 60 * 1000,
  upcomingOdds: 3 * 60 * 1000,
  liveOdds: 45 * 1000,
  scores: 45 * 1000,
  results: 2 * 60 * 1000,
} as const;

export type CacheClass = keyof typeof CACHE_TTL_MS;

export interface LoadResult<T> {
  data: T | null;
  freshness: Freshness;
}

interface InFlight {
  promise: Promise<unknown>;
  startedAt: number;
}

export class RefreshManager {
  private readonly inFlight = new Map<string, InFlight>();
  private readonly meta: MetaRepository;

  constructor(meta: MetaRepository) {
    this.meta = meta;
  }

  /**
   * Fetch through the cache.
   *
   * `freshnessClass` decides only how the result is *labelled* as stale to
   * the user; `cacheClass` decides when KOVR bothers to refetch. They differ
   * deliberately: data can be worth reusing for longer than it is worth
   * calling live.
   */
  async load<T>(
    key: string,
    cacheClass: CacheClass,
    freshnessClass: FreshnessClass,
    loader: () => Promise<T>,
    options: { forceRefresh?: boolean } = {},
  ): Promise<LoadResult<T>> {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    if (!options.forceRefresh) {
      const cached = this.meta.getCache(key, nowIso);
      if (cached) {
        const parsed = RefreshManager.parse<T>(cached.payload);
        if (parsed.ok) {
          return {
            data: parsed.value,
            freshness: buildFreshness('live', cached.fetchedAt, freshnessClass, null, now),
          };
        }
      }
    }

    // Deduplicate: a second caller for the same key joins the first request.
    const existing = this.inFlight.get(key);
    if (existing) {
      try {
        const data = (await existing.promise) as T;
        return {
          data,
          freshness: buildFreshness('live', new Date(existing.startedAt).toISOString(), freshnessClass, null, Date.now()),
        };
      } catch {
        // Fall through and serve this caller from cache below.
        return this.fallbackToCache<T>(key, freshnessClass, 'The provider request failed');
      }
    }

    const promise = loader();
    this.inFlight.set(key, { promise, startedAt: now });

    try {
      const data = await promise;
      const fetchedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + CACHE_TTL_MS[cacheClass]).toISOString();
      this.meta.setCache(key, JSON.stringify(data), fetchedAt, expiresAt);
      return { data, freshness: buildFreshness('live', fetchedAt, freshnessClass, null, Date.now()) };
    } catch (error) {
      const message = RefreshManager.describe(error);
      return this.fallbackToCache<T>(key, freshnessClass, message);
    } finally {
      this.inFlight.delete(key);
    }
  }

  /**
   * Serve the last good payload, marked as cache, or report unavailable.
   * Never synthesises a payload to fill the gap.
   */
  private fallbackToCache<T>(key: string, freshnessClass: FreshnessClass, error: string): LoadResult<T> {
    const stale = this.meta.getCacheIgnoringExpiry(key);
    if (stale) {
      const parsed = RefreshManager.parse<T>(stale.payload);
      if (parsed.ok) {
        return {
          data: parsed.value,
          freshness: buildFreshness('cache', stale.fetchedAt, freshnessClass, error, Date.now()),
        };
      }
    }
    return { data: null, freshness: buildFreshness('unavailable', null, freshnessClass, error, Date.now()) };
  }

  private static parse<T>(payload: string): { ok: true; value: T } | { ok: false } {
    try {
      return { ok: true, value: JSON.parse(payload) as T };
    } catch {
      return { ok: false };
    }
  }

  /** A user-facing description of a failure, with any secret scrubbed out. */
  static describe(error: unknown): string {
    if (error instanceof ProviderError) {
      switch (error.code) {
        case 'NOT_CONFIGURED':
          return 'No sports data provider is configured.';
        case 'AUTH_FAILED':
          return 'The sports data provider rejected the configured credentials.';
        case 'RATE_LIMITED':
          return 'The sports data provider is rate limiting requests.';
        case 'BUDGET_EXCEEDED':
          return 'KOVR has reached its configured hourly provider request budget.';
        case 'NETWORK':
          return 'The sports data provider could not be reached.';
        case 'NOT_FOUND':
          return 'The sports data provider has no record of that event.';
        default:
          return redactSecrets(error.message);
      }
    }
    return redactSecrets(error instanceof Error ? error.message : String(error));
  }

  /** Merge several freshness values into the weakest of them. */
  static weakest(values: readonly Freshness[]): Freshness {
    if (values.length === 0) {
      return { source: 'unavailable', lastUpdatedAt: null, ageMs: null, stale: true, error: null };
    }
    const rank: Record<DataSource, number> = { live: 0, cache: 1, unavailable: 2 };
    let worst = values[0] as Freshness;
    for (const value of values) {
      if (rank[value.source] > rank[worst.source]) worst = value;
      else if (rank[value.source] === rank[worst.source] && (value.ageMs ?? 0) > (worst.ageMs ?? 0)) worst = value;
    }
    return { ...worst, stale: values.some((v) => v.stale) };
  }

  inFlightCount(): number {
    return this.inFlight.size;
  }
}
