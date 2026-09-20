/**
 * KOVR service worker.
 *
 * The shell is cached so the app opens instantly and survives a dropped
 * connection. API responses are deliberately NOT cached here: odds, balances
 * and bet statuses must never be served from a stale copy the user cannot
 * tell apart from a live one. When the network is gone, the app says so.
 */

const SHELL_CACHE = 'kovr-shell-v1';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/styles/kovr.css',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // A single missing asset must not block installation of the worker.
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((asset) => cache.add(asset))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache the API. Stale money and stale prices are worse than an error.
  if (url.pathname.startsWith('/api/')) return;

  // Navigations: network first, shell as the offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html').then((hit) => hit ?? Response.error())),
    );
    return;
  }

  // Static assets: serve from cache, refresh in the background.
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => hit ?? Response.error());
      return hit ?? network;
    }),
  );
});
