'use strict';
/**
 * Planzo server — zero external dependencies, Node 18+.
 *
 * Serves: the waitlist site, the PWA, the anonymous participant flow, and
 * the JSON API that all three (and any future native app) share.
 */
require('./lib/env');

const http = require('http');
const fs = require('fs');
const path = require('path');
const routes = require('./server/routes');

const PORT = Number(process.env.PORT) || 4000;
const PUBLIC = path.join(__dirname, 'public');
// The React app (planzo/app) builds to app/dist and is served at /app —
// this is a separate root from PUBLIC/app, which is the old vanilla PWA.
const APP_DIST = path.join(__dirname, 'app', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...headers,
  });
  res.end(payload);
}

function serveStatic(req, res, urlPath, root = PUBLIC) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  const full = path.normalize(path.join(root, rel));
  // Path traversal guard: the resolved path must stay inside root.
  if (!full.startsWith(root)) return send(res, 403, { error: 'forbidden' });
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;

  const ext = path.extname(full);
  const cacheable = ['.png', '.svg', '.ico', '.webmanifest'].includes(ext);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': cacheable ? 'public, max-age=86400' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  fs.createReadStream(full).pipe(res);
  return true;
}

async function readBody(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('payload_too_large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('invalid_json')); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket.remoteAddress || 'unknown';

  try {
    if (req.method === 'OPTIONS') return send(res, 204, '');

    if (url.pathname.startsWith('/api/')) {
      let body = {};
      if (req.method === 'POST' || req.method === 'PATCH') {
        try { body = await readBody(req); }
        catch (e) { return send(res, 400, { error: e.message }); }
      }
      const result = await routes.handle({ method: req.method, url, body, ip, headers: req.headers });
      return send(res, result.status || 200, result.body, result.headers || {});
    }

    // Pretty routes for the participant flow and the app shell.
    if (url.pathname.startsWith('/p/')) {
      return serveStatic(req, res, '/p/index.html') || send(res, 404, { error: 'not_found' });
    }
    if (url.pathname === '/app' || url.pathname.startsWith('/app/')) {
      const rel = url.pathname.slice('/app'.length) || '/';
      if (serveStatic(req, res, rel, APP_DIST)) return;
      return serveStatic(req, res, '/index.html', APP_DIST) || send(res, 404, { error: 'not_found' });
    }

    if (serveStatic(req, res, url.pathname)) return;
    return send(res, 404, { error: 'not_found' });
  } catch (err) {
    console.error('[planzo] unhandled', url.pathname, err);
    return send(res, 500, { error: 'server_error' });
  } finally {
    if (url.pathname.startsWith('/api/')) {
      console.log(`${req.method} ${url.pathname} ${Date.now() - started}ms`);
    }
  }
});

server.listen(PORT, () => {
  const store = require('./lib/store');
  const ai = require('./services/ai');
  const places = require('./services/places');
  console.log(`
  PLANZO  →  http://localhost:${PORT}
  ────────────────────────────────────────────
  Waitlist     /                 
  App (PWA)    /app              
  Participant  /p/<code>         
  Cost report  /api/admin/cost   
  ────────────────────────────────────────────
  Storage      ${store.remote ? `Upstash Redis (prefix ${store.PREFIX})` : 'local files ./data'}
  AI           ${ai.enabled() ? 'enabled — capped' : 'DISABLED — $0 spend, rules engine only'}
  Places       ${places.enabled() ? 'enabled — capped' : 'DISABLED — venues report unavailable'}
  Weather      ${process.env.PLANZO_WEATHER_ENABLED === 'false' ? 'disabled' : 'Open-Meteo (free)'}
  `);
});
