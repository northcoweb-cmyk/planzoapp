'use strict';
/**
 * Planzo key/value store.
 *
 * Backed by Upstash Redis REST when configured, ./data/*.json otherwise.
 * Every key is prefixed (default "planzo:") so this can share the same
 * Upstash database as NorthCo without ever seeing a northco:* key.
 *
 * This is the ONLY file that knows how data is persisted. Moving to
 * Supabase/Postgres later means reimplementing this interface, nothing else.
 */
const fs = require('fs');
const path = require('path');

const URL_   = process.env.UPSTASH_REDIS_REST_URL || '';
const TOKEN  = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const PREFIX = process.env.PLANZO_REDIS_PREFIX || 'planzo:';
// On Vercel (and other read-only-bundle serverless hosts) the deployed code
// directory can't be written to — only /tmp is. That storage doesn't
// survive between invocations, but it means the file fallback degrades to
// "forgets on cold start" instead of crashing every request. Configure
// Upstash for real persistence in production.
const DIR = (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
  ? path.join(require('os').tmpdir(), 'planzo-data')
  : path.join(__dirname, '..', 'data');

const remote = Boolean(URL_ && TOKEN);
if (!remote) fs.mkdirSync(DIR, { recursive: true });

function guard(key) {
  if (typeof key !== 'string' || !key) throw new Error('store: bad key');
  if (key.includes('northco:')) throw new Error('store: refusing to touch northco namespace');
  return PREFIX + key;
}
const fileFor = key => path.join(DIR, guard(key).replace(/[^a-zA-Z0-9_.-]/g, '_') + '.json');

async function cmd(args) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return (await res.json()).result;
}

async function get(key) {
  const k = guard(key);                     // outside try: a namespace violation
  try {                                     // is a programming error, not a miss
    if (remote) {
      const raw = await cmd(['GET', k]);
      return raw == null ? null : JSON.parse(raw);
    }
    const f = fileFor(key);
    if (!fs.existsSync(f)) return null;
    const parsed = JSON.parse(fs.readFileSync(f, 'utf8'));
    // Values written with a TTL are wrapped {v, exp}; unwrap and expire them
    // so the file backend behaves identically to Redis.
    if (parsed && typeof parsed === 'object' && 'v' in parsed && 'exp' in parsed) {
      if (parsed.exp && parsed.exp < Date.now()) { fs.unlinkSync(f); return null; }
      return parsed.v;
    }
    return parsed;
  } catch (e) { console.error('[store.get]', key, e.message); return null; }
}

async function set(key, value, ttlSeconds) {
  const k = guard(key);
  try {
    if (remote) {
      const args = ['SET', k, JSON.stringify(value)];
      if (ttlSeconds) args.push('EX', String(Math.floor(ttlSeconds)));
      await cmd(args);
      return true;
    }
    const body = { v: value, exp: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0 };
    fs.writeFileSync(fileFor(key), JSON.stringify(ttlSeconds ? body : value));
    return true;
  } catch (e) { console.error('[store.set]', key, e.message); return false; }
}

async function del(key) {
  const k = guard(key);
  try {
    if (remote) { await cmd(['DEL', k]); return true; }
    const f = fileFor(key);
    if (fs.existsSync(f)) fs.unlinkSync(f);
    return true;
  } catch (e) { console.error('[store.del]', key, e.message); return false; }
}

/** Atomic counter — the basis of the spend ledger and rate limits. */
async function incrBy(key, amount, ttlSeconds) {
  guard(key);
  if (remote) {
    const n = await cmd(['INCRBYFLOAT', guard(key), String(amount)]);
    if (ttlSeconds) await cmd(['EXPIRE', guard(key), String(Math.floor(ttlSeconds))]);
    return Number(n);
  }
  const cur = Number(await get(key)) || 0;
  const next = cur + amount;
  await set(key, next, ttlSeconds);
  return next;
}

/**
 * Compare-and-set. Returns true only if the key was absent.
 * Upstash SET NX is atomic, which is what makes ticket check-in safe
 * against two door staff scanning the same ticket simultaneously.
 */
async function setIfAbsent(key, value, ttlSeconds) {
  guard(key);
  if (remote) {
    const args = ['SET', guard(key), JSON.stringify(value), 'NX'];
    if (ttlSeconds) args.push('EX', String(Math.floor(ttlSeconds)));
    return (await cmd(args)) === 'OK';
  }
  const f = fileFor(key);
  try { fs.writeFileSync(f, JSON.stringify(value), { flag: 'wx' }); return true; }
  catch { return false; }
}

/** Append to a capped list. */
async function push(key, item, cap = 500) {
  const arr = (await get(key)) || [];
  arr.push(item);
  while (arr.length > cap) arr.shift();
  await set(key, arr);
  return arr;
}

module.exports = { get, set, del, incrBy, setIfAbsent, push, remote, PREFIX };
