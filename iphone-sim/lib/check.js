// Server-side probe of a target URL: can it be embedded, and what is its "deploy fingerprint"?
// Used by both the Vercel function (api/check.js) and the local server.
const dns = require('dns').promises;
const net = require('net');
const crypto = require('crypto');

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:127.') || v.startsWith('::ffff:10.') || v.startsWith('::ffff:192.168.');
}

async function assertPublic(u, allowPrivate) {
  if (allowPrivate) return;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error('Private/internal addresses are not allowed.');
}

function normalize(input) {
  let s = String(input || '').trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = (/^(localhost|127\.|192\.168\.|10\.)/.test(s) ? 'http://' : 'https://') + s;
  try { const u = new URL(s); return /^https?:$/.test(u.protocol) ? u : null; } catch { return null; }
}

function frameVerdict(headers, origin) {
  const xfo = (headers.get('x-frame-options') || '').toLowerCase();
  if (xfo.includes('deny') || xfo.includes('sameorigin')) return `X-Frame-Options: ${xfo.trim()}`;
  const csp = headers.get('content-security-policy') || '';
  const m = csp.match(/frame-ancestors\s+([^;]+)/i);
  if (m) {
    const list = m[1].trim().split(/\s+/);
    const ok = list.includes('*') || list.includes('https:') || (origin && list.includes(origin));
    if (!ok) return `CSP frame-ancestors ${m[1].trim()}`;
  }
  return null;
}

function fingerprint(html) {
  // Hash the build-specific asset URLs (they change every deploy) instead of the whole body,
  // which can contain per-request nonces/timestamps and would cause endless reloads.
  const assets = [...html.matchAll(/<(?:script[^>]+src|link[^>]+href)=["']([^"']+)["']/gi)].map((x) => x[1]).sort();
  const basis = assets.length ? assets.join('\n') : html;
  return crypto.createHash('sha1').update(basis).digest('hex').slice(0, 16);
}

async function checkUrl(input, { origin = '', allowPrivate = false } = {}) {
  let u = normalize(input);
  if (!u) return { ok: false, error: 'That does not look like a valid URL.' };
  let res;
  for (let hop = 0; hop < 6; hop++) {
    await assertPublic(u, allowPrivate);
    res = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(9000), headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' } });
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) { u = new URL(loc, u); continue; }
    break;
  }
  const buf = Buffer.from(await res.arrayBuffer()).subarray(0, 512 * 1024);
  const html = buf.toString('utf8');
  return {
    ok: res.status < 500,
    status: res.status,
    finalUrl: u.href,
    blocked: frameVerdict(res.headers, origin),
    fingerprint: fingerprint(html),
    title: (html.match(/<title[^>]*>([^<]*)/i) || [])[1] || '',
  };
}

module.exports = { checkUrl, normalize, assertPublic };
