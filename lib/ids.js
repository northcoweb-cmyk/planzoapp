'use strict';
const crypto = require('crypto');

const SECRET = process.env.PLANZO_SECRET || '';
if (!SECRET && process.env.NODE_ENV === 'production') {
  console.error('[planzo] FATAL: PLANZO_SECRET is not set. Refusing to sign tokens with a default.');
  process.exit(1);
}
const KEY = SECRET || 'dev-only-insecure-secret-do-not-ship';

/** URL-safe opaque id. Never exposes a database key. */
function token(bytes = 18) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Short human-shareable plan code, e.g. "k3f9qb". Ambiguous chars removed. */
function planCode() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const buf = crypto.randomBytes(8);
  let out = '';
  for (const b of buf) out += alphabet[b % alphabet.length];
  return out;
}

function hash(value) {
  return crypto.createHmac('sha256', KEY).update(String(value)).digest('hex');
}

/** Signed, tamper-evident payload for participant sessions. */
function sign(payload, ttlSeconds = 60 * 60 * 24 * 90) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlSeconds * 1000 }))
    .toString('base64url');
  return `${body}.${crypto.createHmac('sha256', KEY).update(body).digest('base64url')}`;
}

function verify(signed) {
  if (typeof signed !== 'string' || !signed.includes('.')) return null;
  const [body, sig] = signed.split('.');
  const expect = crypto.createHmac('sha256', KEY).update(body).digest('base64url');
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

module.exports = { token, planCode, hash, sign, verify };
