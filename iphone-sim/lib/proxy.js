// Same-origin pass-through so a target app runs "first-party" inside the simulator frame.
// Why: in a cross-site iframe browsers drop the app's login cookie (login → bounce back to login).
// Served from the simulator's own origin, cookies behave normally.
//
// Safety: only forwards to hosts allowed by ALLOWED_HOSTS (default: *.vercel.app) and never to
// private/internal addresses. Set ALLOWED_HOSTS="*.vercel.app,myapp.com" to add custom domains.
const { assertPublic } = require('./check');

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const DROP_REQ = new Set(['host', 'connection', 'content-length', 'accept-encoding', 'cookie', 'origin', 'referer', 'forwarded', 'x-real-ip', 'user-agent', 'transfer-encoding', 'upgrade']);
const DROP_RES = new Set(['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'x-frame-options', 'strict-transport-security', 'set-cookie', 'location', 'content-security-policy', 'content-security-policy-report-only', 'keep-alive']);
const TEXTY = /^(text\/html|text\/css|application\/(javascript|x-javascript|json)|text\/javascript)/i;

function allowedHost(hostname, list) {
  return list.some((p) => (p.startsWith('*.') ? hostname === p.slice(2) || hostname.endsWith(p.slice(1)) : hostname === p));
}
function cookiesOf(header) {
  const out = {};
  for (const part of (header || '').split(/;\s*/)) { const i = part.indexOf('='); if (i > 0) out[part.slice(0, i)] = part.slice(i + 1); }
  return out;
}
function rewriteSetCookie(c) {
  return c.replace(/;\s*Domain=[^;]*/i, '').replace(/;\s*Partitioned/i, '').replace(/;\s*SameSite=None/i, '; SameSite=Lax');
}
const shim = (UA) => `<script>(function(){try{var ua=${JSON.stringify(UA)};Object.defineProperty(navigator,'userAgent',{get:function(){return ua}});Object.defineProperty(navigator,'platform',{get:function(){return 'iPhone'}});Object.defineProperty(navigator,'maxTouchPoints',{get:function(){return 5}});Object.defineProperty(navigator,'vendor',{get:function(){return 'Apple Computer, Inc.'}})}catch(e){}})();</script>`;

async function proxy(req, res, { path = '/', allowedHosts, allowPrivate = false } = {}) {
  const list = (allowedHosts || process.env.ALLOWED_HOSTS || '*.vercel.app').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const any = list.includes('*') || process.env.ALLOW_ANY_HOST === '1';
  const send = (code, text) => { res.statusCode = code; res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.end(text); };

  let origin;
  try { origin = decodeURIComponent(cookiesOf(req.headers.cookie).sim_origin || ''); } catch { origin = ''; }
  let target;
  try { target = new URL(origin); } catch { return send(400, 'No app selected. Open the simulator page and paste a link first.'); }
  if (!/^https?:$/.test(target.protocol)) return send(400, 'Bad target.');
  if (!any && !allowedHost(target.hostname.toLowerCase(), list)) return send(403, `This simulator only opens ${list.join(', ')} apps. Set ALLOWED_HOSTS to allow ${target.hostname}.`);
  try { await assertPublic(target, allowPrivate); } catch (e) { return send(403, String(e.message)); }

  const url = new URL(path, target.origin);
  const simProto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0];
  const simOrigin = `${simProto}://${req.headers['x-forwarded-host'] || req.headers.host}`;

  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (DROP_REQ.has(k) || k.startsWith('x-vercel') || k.startsWith('x-forwarded') || k.startsWith('sec-fetch')) continue;
    headers[k] = v;
  }
  headers['user-agent'] = MOBILE_UA;
  headers['accept-encoding'] = 'identity';
  headers.origin = target.origin;
  if (req.headers.referer) headers.referer = req.headers.referer.split(simOrigin).join(target.origin);
  const jar = Object.entries(cookiesOf(req.headers.cookie)).filter(([k]) => k !== 'sim_origin').map(([k, v]) => `${k}=${v}`).join('; ');
  if (jar) headers.cookie = jar;

  let body;
  if (!['GET', 'HEAD'].includes(req.method)) {
    const chunks = []; for await (const c of req) chunks.push(c); body = Buffer.concat(chunks);
  }

  let up;
  try { up = await fetch(url, { method: req.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(25000) }); }
  catch (e) { return send(502, `Could not reach ${target.origin}: ${e.message}`); }

  res.statusCode = up.status;
  for (const [k, v] of up.headers) if (!DROP_RES.has(k)) res.setHeader(k, v);
  const cookies = up.headers.getSetCookie ? up.headers.getSetCookie() : [];
  if (cookies.length) res.setHeader('Set-Cookie', cookies.map(rewriteSetCookie));
  const loc = up.headers.get('location');
  if (loc) res.setHeader('Location', loc.startsWith(target.origin) ? loc.slice(target.origin.length) || '/' : loc);
  const csp = up.headers.get('content-security-policy');
  if (csp) res.setHeader('Content-Security-Policy', csp.split(';').filter((d) => !/^\s*frame-ancestors/i.test(d)).join(';').split(target.origin).join(simOrigin));

  const type = up.headers.get('content-type') || '';
  if (req.method === 'HEAD' || !up.body) return res.end();
  if (!TEXTY.test(type)) { // images, fonts, streams: pass straight through
    const { Readable } = require('stream');
    return Readable.fromWeb(up.body).pipe(res);
  }
  let text = await up.text();
  text = text.split(target.origin).join(simOrigin); // absolute links/API bases → same origin
  if (/^text\/html/i.test(type)) text = /<head[^>]*>/i.test(text) ? text.replace(/<head[^>]*>/i, (m) => m + shim(MOBILE_UA)) : shim(MOBILE_UA) + text;
  res.setHeader('Content-Type', type);
  res.end(text);
}

module.exports = { proxy, allowedHost };
