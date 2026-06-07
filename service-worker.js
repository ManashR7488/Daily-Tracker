/* ═══════════════════════════════════════════════════════
   FinTrack — Service Worker
   Strategy: Cache-First for local assets,
             Network-First for external CDN/fonts.
═══════════════════════════════════════════════════════ */

'use strict';

const CACHE_VERSION  = 'fintrack-v0.1';
const LOCAL_ASSETS   = [
  './',
  './index.html',
  './income.html',
  './expenses.html',
  './food.html',
  './history.html',
  './app.js',
  './styles.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './setting.html',
  './setting.js'
];

/* ── INSTALL ─────────────────────────────────────────── */
self.addEventListener('install', event => {
  console.log('[SW] Installing:', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(LOCAL_ASSETS))
      .then(() => {
        console.log('[SW] All assets cached');
        return self.skipWaiting();   // activate immediately
      })
      .catch(err => console.warn('[SW] Cache addAll error:', err))
  );
});

/* ── ACTIVATE ────────────────────────────────────────── */
self.addEventListener('activate', event => {
  console.log('[SW] Activating:', CACHE_VERSION);
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE_VERSION)
            .map(k => {
              console.log('[SW] Removing old cache:', k);
              return caches.delete(k);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ── MESSAGE ─────────────────────────────────────────── */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ── FETCH ───────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and non-http(s) requests
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // External resources (fonts, CDN): network-first, cache as fallback
  if (!url.origin.includes(self.location.origin)) {
    event.respondWith(networkFirstThenCache(request));
    return;
  }

  // Local assets: cache-first, then network
  event.respondWith(cacheFirstThenNetwork(request));
});

/* ── STRATEGIES ──────────────────────────────────────── */

async function cacheFirstThenNetwork(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && response.status < 400) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());   // async, non-blocking
    }
    return response;
  } catch {
    // Offline fallback: serve index.html for navigations
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      return fallback || new Response('<h2>FinTrack is offline</h2>', {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    return new Response('', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function networkFirstThenCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('', { status: 503, statusText: 'Offline' });
  }
}

/* ── MESSAGE HANDLER (manual cache refresh) ─────────── */
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
