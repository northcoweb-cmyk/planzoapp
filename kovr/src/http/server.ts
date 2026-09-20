/**
 * The KOVR HTTP server.
 *
 * Serves the API, the web app and its static assets from one origin, so the
 * browser never holds a credential and never calls a data provider directly.
 */

import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AppContext } from '../services/context.js';
import { apiRoutes } from './routes/api.js';
import { adminRoutes } from './routes/admin.js';
import { serveAppShell, serveStatic } from './static.js';
import { sendJson } from './router.js';

/** Paths owned by the client-side router, which all render the app shell. */
const APP_ROUTES = new Set(['/', '/sports', '/betslip', '/bets', '/wallet', '/profile', '/activity', '/admin']);

export function createKovrServer(context: AppContext): Server {
  const api = apiRoutes(context);
  const admin = adminRoutes(context);

  return createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

      // KOVR is same-origin and stores no credentials, but a page this
      // rich should still refuse to be framed or sniffed.
      response.setHeader('x-content-type-options', 'nosniff');
      response.setHeader('x-frame-options', 'SAMEORIGIN');
      response.setHeader('referrer-policy', 'same-origin');

      if (request.method !== 'GET' && request.method !== 'POST') {
        sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
        return;
      }

      if (await admin.handle(request, response, url)) return;
      if (await api.handle(request, response, url)) return;

      if (url.pathname.startsWith('/api/')) {
        sendJson(response, 404, { error: 'No such endpoint.', code: 'NOT_FOUND' });
        return;
      }

      if (serveStatic(url.pathname, response)) return;
      if (
        APP_ROUTES.has(url.pathname) ||
        url.pathname.startsWith('/event/') ||
        url.pathname.startsWith('/league/')
      ) {
        serveAppShell(response);
        return;
      }

      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    })();
  });
}
