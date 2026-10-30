/* LocalBoost service worker: offline app shell + demo dataset.
   Updates are controlled: a new worker waits until the user taps "Reload" (SKIP_WAITING). */
const VERSION = 'localboost-dev';
const CACHE = `lb-shell-${VERSION}`;
const FONTS = 'lb-fonts-v1';
const SHELL = ['/', '/index.html', '/preview.html', '/manifest.json', '/css/styles.css',
  '/icons/favicon.svg', '/icons/logo.png', '/icons/pattern.svg', '/icons/favicon-32.png', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png',
  '/js/app.js', '/js/ai.js', '/js/business.js', '/js/charts.js', '/js/collect.js', '/js/core.js', '/js/data.js', '/js/i18n.js', '/js/mission.js', '/js/names.js', '/js/prompts.js',
  '/js/pwa.js', '/js/registry.js', '/js/seed.js', '/js/siteTemplate.js', '/js/store.js', '/js/theme.js', '/js/website.js',
  '/js/locales/en.js', '/js/locales/ro.js', '/js/locales/fr.js', '/js/locales/de.js', '/js/locales/hu.js',
  '/js/views/account.js', '/js/views/competitors.js', '/js/views/diagnosis.js', '/js/views/mission.js', '/js/views/overview.js', '/js/views/pack.js',
  '/js/views/proof.js', '/js/views/settings.js', '/js/views/shared.js', '/js/views/signals.js', '/js/views/website.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('lb-shell-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data?.type === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) return; // AI calls: network only, app has its own fallback

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith((async () => {
      const cache = await caches.open(FONTS); const hit = await cache.match(req);
      const net = fetch(req).then((r) => { if (r.ok || r.type === 'opaque') cache.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })());
    return;
  }
  if (url.origin !== location.origin) return;

  if (req.mode === 'navigate') {
    const shellKey = url.pathname.startsWith('/preview/') ? '/preview.html' : '/index.html';
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const net = await fetch(shellKey, { cache: 'no-cache' });
        if (net.ok) { cache.put(shellKey, net.clone()); return net; }
      } catch { /* offline: fall through to cache */ }
      return (await cache.match(shellKey)) || (await cache.match('/index.html')) || Response.error();
    })());
    return;
  }
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // dev builds (unstamped version) go network-first so edits show up immediately; release builds are cache-first
    if (VERSION === 'localboost-dev') {
      try { const net = await fetch(req, { cache: 'no-cache' }); if (net.ok) cache.put(req, net.clone()); return net; }
      catch { return (await cache.match(req, { ignoreSearch: true })) || Response.error(); }
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try { const net = await fetch(req); if (net.ok) cache.put(req, net.clone()); return net; }
    catch { return Response.error(); }
  })());
});
