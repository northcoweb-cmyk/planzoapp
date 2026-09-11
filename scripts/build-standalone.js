'use strict';
/**
 * Builds the two standalone single-file HTML deliverables into dist/.
 *
 *   dist/planzo-waitlist.html   — landing page, one file, no dependencies
 *   dist/planzo-app.html        — the whole app, one file, no server needed
 *
 * The app file is GENERATED FROM the engine sources rather than being a
 * hand-written copy. engine/*.js are inlined verbatim inside a tiny CommonJS
 * shim, with browser adapters standing in for the Node-only modules they
 * require. That means the standalone file runs the exact code covered by
 * `npm test` — it cannot drift from the tested engine.
 *
 * Run: node scripts/build-standalone.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const css = read('public/planzo.css');
const renderer = read('public/plan-render.js');
const app = read('public/app/app.js');
const localBackend = read('build/backend-local.js');

/** Wrap a CommonJS source file as a registry entry. */
function mod(name, source) {
  return `__def(${JSON.stringify(name)}, function(module, exports, require){\n${source}\n});`;
}

// ── Browser adapters for the Node-only modules the engine requires ──────
// Each keeps the same interface and the same honesty contract: when a
// capability is absent it reports unavailable. None of them invent data.
const ADAPTERS = [
  mod('../lib/store', `
    // localStorage-backed store. Same interface as lib/store.js.
    const P = 'planzo.kv.';
    module.exports = {
      async get(k){
        try {
          const raw = localStorage.getItem(P + k);
          if (raw == null) return null;
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && 'v' in parsed && 'exp' in parsed){
            if (parsed.exp && parsed.exp < Date.now()){ localStorage.removeItem(P + k); return null; }
            return parsed.v;
          }
          return parsed;
        } catch { return null; }
      },
      async set(k, v, ttl){
        try { localStorage.setItem(P + k, JSON.stringify(ttl ? { v, exp: Date.now() + ttl*1000 } : v)); return true; }
        catch { return false; }
      },
      async del(k){ try { localStorage.removeItem(P + k); } catch {} return true; },
      async incrBy(k, n){ const c = Number(await this.get(k)) || 0; await this.set(k, c + n); return c + n; },
      async setIfAbsent(k, v){ if (await this.get(k) != null) return false; await this.set(k, v); return true; },
      async push(k, item, cap = 500){
        const a = (await this.get(k)) || []; a.push(item);
        while (a.length > cap) a.shift();
        await this.set(k, a); return a;
      },
      remote: false, PREFIX: P,
    };`),

  mod('../lib/ids', `
    const A = 'abcdefghjkmnpqrstuvwxyz23456789';
    const rand = n => { const b = new Uint8Array(n); crypto.getRandomValues(b); return b; };
    module.exports = {
      token: (bytes = 18) => Array.from(rand(bytes), b => A[b % A.length]).join(''),
      planCode: () => Array.from(rand(8), b => A[b % A.length]).join(''),
      // Non-cryptographic: used here only as a cache key, never for a session
      // or a ticket. Those stay server-side, where the real HMAC lives.
      hash: v => { let h = 0x811c9dc5; const s = String(v);
        for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
        return (h >>> 0).toString(16).padStart(8, '0').repeat(4); },
      sign: p => btoa(JSON.stringify(p)), verify: () => null,
    };`),

  mod('../lib/cache', `
    const store = require('../lib/store');
    const inflight = new Map();
    module.exports = {
      async wrap(key, ttl, producer){
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
      },
      TTL: { weather: 1800, place_details: 604800, place_search: 43200, event: 21600, geocode: 2592000, ai_intent: 1209600 },
    };`),

  mod('../services/ai', `
    // No API key can live in a file the user can open, so AI is off here by
    // definition. intent.parse() handles the idea deterministically.
    module.exports = {
      enabled: () => false,
      async ask(){ return { ok: false, reason: 'ai_disabled' }; },
      async askJson(){ return { ok: false, reason: 'ai_disabled' }; },
    };`),

  mod('../lib/cost', `
    // No paid provider is reachable from a downloadable file, so nothing here
    // can spend money. The governor is a no-op rather than a fake ledger.
    module.exports = {
      async reserve(){ return { ok: false, reason: 'not_available_offline' }; },
      async record(){}, async report(){ return { services: {} }; },
      estimateAiCost: () => 0, PLACES_PRICES: { textsearch: 0, details: 0, nearby: 0 },
      LIMITS: {},
    };`),

  mod('../services/places', `
    // Google Places needs a server-side key. Rather than ship a key in a
    // downloadable file, this reports unavailable — and the plan says so
    // instead of naming a venue nobody verified.
    module.exports = {
      enabled: () => false,
      async search(){ return { available: false, reason: 'places_not_configured' }; },
      async details(){ return { available: false, reason: 'places_not_configured' }; },
    };`),
];

// These run unmodified in a browser and are inlined verbatim, not adapted.
// services/weather.js included: Open-Meteo is keyless and sends CORS headers.
const ENGINE = [
  mod('../services/weather', read('services/weather.js')),
  mod('../services/events',  read('services/events.js')),
  mod('../lib/qr',           read('lib/qr.js')),
  mod('./catalog',   read('engine/catalog.js')),
  mod('./consensus', read('engine/consensus.js')),
  mod('./questions', read('engine/questions.js')),
  mod('./intent',    read('engine/intent.js')),
  mod('./plan',      read('engine/plan.js')),
  mod('./trips',     read('engine/trips.js')),
  mod('./search',    read('engine/search.js')),
  mod('./tickets',   read('engine/tickets.js')),
  mod('./hosting',   read('engine/hosting.js')),
  mod('./memory',    read('engine/memory.js')),
  mod('./expenses',  read('engine/expenses.js')),
  mod('./calendar',  read('engine/calendar.js')),
];

const RUNTIME = `
/* ── Minimal CommonJS registry ─────────────────────────────────────────
   Lets the engine files below run in the browser byte-for-byte as they do
   under Node, so the standalone build stays in lockstep with the tests. */
const __mods = {}, __cache = {};
function __def(name, fn){ __mods[normalize(name)] = fn; }
function normalize(n){ return n.replace(/^\\.{1,2}\\//, '').replace(/^(lib|services|engine)\\//, '$1/'); }
function require(name){
  const key = normalize(name);
  if (__cache[key]) return __cache[key].exports;
  const fn = __mods[key];
  if (!fn) throw new Error('module not found: ' + name);
  const m = { exports: {} };
  __cache[key] = m;
  fn(m, m.exports, require);
  return m.exports;
}
const process = { env: {} };
`;

// ─────────────────────────────────────────────────────────────────────────
function buildApp() {
  const shell = read('build/app-shell.html');
  return shell
    .replace('/*__CSS__*/', () => css)
    .replace('/*__RENDERER__*/', () => renderer)
    .replace('/*__ENGINE__*/', () => [RUNTIME, ...ADAPTERS, ...ENGINE].join('\n\n'))
    .replace('/*__BACKEND__*/', () => localBackend)
    .replace('/*__APP__*/', () => app);
}

function buildWaitlist() {
  return read('build/waitlist.html').replace('/*__CSS__*/', () => css);
}

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
for (const [file, contents] of [
  ['dist/planzo-waitlist.html', buildWaitlist()],
  ['dist/planzo-app.html', buildApp()],
]) {
  fs.writeFileSync(path.join(ROOT, file), contents);
  console.log(`  ${file}  ${(contents.length / 1024).toFixed(0)} KB`);
}
console.log('\nBoth files are self-contained. Open either one directly in a browser.\n');
