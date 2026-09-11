// @ts-nocheck
/* TTL cache + in-flight dedupe. Mirrors planzo/lib/cache.js. */
import store from './store.js';
const inflight = new Map();
export async function wrap(key, ttl, producer) {
  const hit = await store.get('cache:' + key);
  if (hit && hit.v !== undefined) return { value: hit.v, cached: true };
  if (inflight.has(key)) return { value: await inflight.get(key), cached: true, deduped: true };
  const p = (async () => {
    const v = await producer();
    if (v !== undefined) await store.set('cache:' + key, { v, at: Date.now() }, ttl);
    return v;
  })();
  inflight.set(key, p);
  try { return { value: await p, cached: false }; } finally { inflight.delete(key); }
}
export const TTL = {
  weather: 1800, place_details: 604800, place_search: 43200,
  event: 21600, geocode: 2592000, ai_intent: 1209600,
};
export default { wrap, TTL };
