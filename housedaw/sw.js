/* HouseDAW service worker — caches the app shell so it works offline after the first load. */
const CACHE = 'housedaw-v1';
const FILES = ['./', 'index.html', 'manifest.json', 'icon.svg', 'css/style.css', 'js/util.js', 'js/dsp.js', 'js/lib.js', 'js/presets.js', 'js/music.js', 'js/state.js', 'js/fx.js', 'js/instruments.js', 'js/engine.js', 'js/transport.js', 'js/export.js', 'js/store.js', 'js/compose.js', 'js/actions.js', 'js/ai.js', 'js/import.js', 'js/gen.js', 'js/packs.js', 'js/ui-core.js', 'js/ui-browser.js', 'js/ui-timeline.js', 'js/ui-pianoroll.js', 'js/ui-drum.js', 'js/ui-mixer.js', 'js/ui-device.js', 'js/ui-panels.js', 'js/dialogs.js', 'js/app.js', 'js/vendor/lame.min.js', 'packs/manifest.json'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
