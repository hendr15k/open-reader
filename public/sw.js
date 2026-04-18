/* =========================================
   Open Reader — Service Worker v1
   Enables full offline PWA support
   ========================================= */

const CACHE_NAME = 'open-reader-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ── Install: cache shell assets ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first for HTML, cache-first for assets ───────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin (except CDN assets needed for the app)
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // Always serve from cache when offline (cache-first for assets)
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          // Cache successful navigation responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
  }
});

// ── Background sync for saved articles (future enhancement) ─────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-articles') {
    event.waitUntil(syncArticles());
  }
});

async function syncArticles() {
  // Reserved for future: sync offline-created articles when back online
  console.log('[SW] sync-articles triggered');
}
