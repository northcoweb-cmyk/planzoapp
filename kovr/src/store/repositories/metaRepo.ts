/** Small key/value store for provider cache entries and app state. */

import type { Database } from '../db.js';
import { str } from '../rows.js';

export class MetaRepository {
  constructor(private readonly database: Database) {}

  set(key: string, value: string, at: string): void {
    this.database.run(
      `INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      key,
      value,
      at,
    );
  }

  get(key: string): string | null {
    const row = this.database.get('SELECT value FROM app_meta WHERE key = ?', key);
    return row ? str(row, 'value') : null;
  }

  /** Read a cache entry, treating an expired one as absent. */
  getCache(key: string, now: string): { payload: string; fetchedAt: string } | null {
    const row = this.database.get(
      'SELECT payload, fetched_at FROM provider_cache WHERE cache_key = ? AND expires_at > ?',
      key,
      now,
    );
    return row ? { payload: str(row, 'payload'), fetchedAt: str(row, 'fetched_at') } : null;
  }

  /** Read a cache entry regardless of age — the source for stale-but-shown data. */
  getCacheIgnoringExpiry(key: string): { payload: string; fetchedAt: string } | null {
    const row = this.database.get('SELECT payload, fetched_at FROM provider_cache WHERE cache_key = ?', key);
    return row ? { payload: str(row, 'payload'), fetchedAt: str(row, 'fetched_at') } : null;
  }

  setCache(key: string, payload: string, fetchedAt: string, expiresAt: string): void {
    this.database.run(
      `INSERT INTO provider_cache (cache_key, payload, fetched_at, expires_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
         payload = excluded.payload, fetched_at = excluded.fetched_at, expires_at = excluded.expires_at`,
      key,
      payload,
      fetchedAt,
      expiresAt,
    );
  }

  clearCache(): void {
    this.database.run('DELETE FROM provider_cache');
  }
}
