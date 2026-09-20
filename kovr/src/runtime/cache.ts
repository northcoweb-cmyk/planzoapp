/**
 * In-process cache and request log.
 *
 * KOVR is stateless: sports data is re-fetched and cached in memory, and on
 * a managed host the CDN in front holds the shared copy. There is no
 * database, which is what lets the same code run as a long-lived server or
 * as a serverless function.
 */

export interface CacheEntry {
  payload: string;
  fetchedAt: string;
  expiresAt: string;
}

export interface CacheStore {
  get(key: string, nowIso: string): CacheEntry | null;
  /** Ignores expiry — the source for stale-but-shown data during an outage. */
  getStale(key: string): CacheEntry | null;
  set(key: string, entry: CacheEntry): void;
  clear(): void;
  size(): number;
}

export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, CacheEntry>();
  /** Bounded so a long-lived process cannot grow without limit. */
  constructor(private readonly maxEntries = 400) {}

  get(key: string, nowIso: string): CacheEntry | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    return entry.expiresAt > nowIso ? entry : null;
  }

  getStale(key: string): CacheEntry | null {
    return this.entries.get(key) ?? null;
  }

  set(key: string, entry: CacheEntry): void {
    // Re-inserting moves the key to the end, so the oldest is evicted first.
    this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  clear(): void {
    this.entries.clear();
  }

  size(): number {
    return this.entries.size;
  }
}

/* ───────────────────────────── request log ─────────────────────────── */

export interface ProviderRequestRecord {
  endpoint: string;
  requestedAt: string;
  durationMs: number;
  httpStatus: number | null;
  ok: boolean;
  error: string | null;
  quotaRemaining: number | null;
  quotaUsed: number | null;
}

/** Keeps the trailing hour of provider calls, for the budget and for status. */
export class RequestLog {
  private readonly records: ProviderRequestRecord[] = [];

  record(entry: ProviderRequestRecord): void {
    this.records.push(entry);
    if (this.records.length > 200) this.records.splice(0, this.records.length - 200);
  }

  countSince(sinceIso: string): number {
    let count = 0;
    for (const record of this.records) if (record.requestedAt >= sinceIso) count++;
    return count;
  }

  recent(limit = 25): ProviderRequestRecord[] {
    return this.records.slice(-limit).reverse();
  }
}
