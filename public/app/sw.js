/**
 * Planzo service worker.
 *
 * Caches the shell only. API responses are NEVER cached — a plan's state,
 * a group's answers and a ticket's validity must always come from the server.
 * Serving a stale plan would be a correctness bug, not a performance win.
 */
const SHELL = 'planzo-shell-v1';
const ASSETS = ['/app', '/app/index.html', '/planzo.css', '/plan-render.js', '/icon.svg', '/app/manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== SHELL).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;          // always network
  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok && ASSETS.includes(url.pathname)) {
        const copy = res.clone();
        caches.open(SHELL).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('/app/index.html')))
  );
});
