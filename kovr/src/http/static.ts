/**
 * Static file serving for the KOVR web app.
 *
 * Paths are resolved strictly inside `web/`; anything that escapes is
 * refused. The service worker is served with no-cache so an update is never
 * held back by a stale copy of the thing that does the updating.
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import type { ServerResponse } from 'node:http';
import { fromRoot } from '../config/paths.js';

const WEB_ROOT = fromRoot('web');

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** Long-lived for fingerprinted assets, short for the shell, none for the worker. */
function cacheControlFor(pathname: string): string {
  if (pathname === '/sw.js' || pathname.endsWith('.webmanifest')) return 'no-cache';
  if (pathname.startsWith('/icons/')) return 'public, max-age=604800';
  if (pathname.startsWith('/dist/') || pathname.startsWith('/styles/')) return 'public, max-age=3600';
  return 'no-cache';
}

/** Resolve a URL path to a file inside `web/`, or null if it escapes or is missing. */
function resolveFile(pathname: string): string | null {
  const decoded = (() => {
    try {
      return decodeURIComponent(pathname);
    } catch {
      return null;
    }
  })();
  if (decoded === null || decoded.includes('\0')) return null;

  const relative = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const candidate = resolve(join(WEB_ROOT, relative));
  if (candidate !== WEB_ROOT && !candidate.startsWith(WEB_ROOT + sep)) return null;
  if (!existsSync(candidate) || !statSync(candidate).isFile()) return null;
  return candidate;
}

export function serveStatic(pathname: string, response: ServerResponse): boolean {
  const file = resolveFile(pathname === '/' ? '/index.html' : pathname);
  if (!file) return false;

  const type = CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
  response.writeHead(200, {
    'content-type': type,
    'content-length': statSync(file).size,
    'cache-control': cacheControlFor(pathname),
    'x-content-type-options': 'nosniff',
  });
  createReadStream(file).pipe(response);
  return true;
}

/** The app shell, for any path the client-side router owns. */
export function serveAppShell(response: ServerResponse): void {
  if (!serveStatic('/index.html', response)) {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('KOVR web assets are missing. Run `npm run build` first.');
  }
}
