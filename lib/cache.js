'use strict';
/**
 * TTL cache with in-flight request deduplication.
 *
 * Deduplication matters as much as the TTL: seven participants opening the
 * same plan link at once would otherwise fire seven identical Places
 * queries. They now share one.
 */
const store = require('./store');
const inflight = new Map();

/**
 * @param {string} key      cache key (already namespaced by caller)
 * @param {number} ttl      seconds
 * @param {Function} producer  async () => value.  Return undefined to skip caching.
 */
async function wrap(key, ttl, producer) {
  const hit = await store.get(`cache:${key}`);
  if (hit && hit.v !== undefined) return { value: hit.v, cached: true };

  if (inflight.has(key)) return { value: await inflight.get(key), cached: true, deduped: true };

  const p = (async () => {
    const v = await producer();
    if (v !== undefined) await store.set(`cache:${key}`, { v, at: Date.now() }, ttl);
    return v;
  })();
  inflight.set(key, p);
  try { return { value: await p, cached: false }; }
  finally { inflight.delete(key); }
}

/** Freshness policy per data class — spec §49. */
const TTL = {
  weather: 60 * 30,          // 30 min
  place_details: 60 * 60 * 24 * 7,
  place_search: 60 * 60 * 12,
  event: 60 * 60 * 6,
  geocode: 60 * 60 * 24 * 30,
  ai_intent: 60 * 60 * 24 * 14,
};

module.exports = { wrap, TTL };
