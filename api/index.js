'use strict';
/**
 * Vercel serverless entry point. Adapts a Vercel/Node request into the same
 * { method, url, body, ip, headers } shape server.js builds for routes.handle(),
 * so the actual API logic in ../server/routes.js is shared, unmodified, between
 * the Render deployment (server.js, long-running http.Server) and Vercel
 * (this file, one invocation per request).
 */
require('../lib/env');
const routes = require('../server/routes');

module.exports = async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }

    const host = req.headers.host || 'localhost';
    const url = new URL(req.url, `https://${host}`);
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.socket?.remoteAddress || 'unknown';

    let body = {};
    if (req.method === 'POST' || req.method === 'PATCH') {
      // Vercel's Node runtime already buffers the body; req.body may be a
      // parsed object, a raw string, or absent depending on content-type.
      if (req.body && typeof req.body === 'object') body = req.body;
      else if (typeof req.body === 'string' && req.body) {
        try { body = JSON.parse(req.body); }
        catch { return json(res, 400, { error: 'invalid_json' }); }
      }
    }

    const result = await routes.handle({ method: req.method, url, body, ip, headers: req.headers });
    return json(res, result.status || 200, result.body, result.headers || {});
  } catch (err) {
    console.error('[planzo:vercel]', req.url, err);
    return json(res, 500, { error: 'server_error' });
  }
};

function json(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
};
