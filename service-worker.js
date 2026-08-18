/**
 * BATMAN — High-Reliability PWA Service Worker
 * Resilient Offline-First & Stale-While-Revalidate Engine
 */

const CACHE_NAME = 'batman-pwa-v2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/icons/icon.svg',
  '/css/base.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/themes.css',
  '/js/config.js',
  '/js/utils/dates.js',
  '/js/utils/calculations.js',
  '/js/utils/validation.js',
  '/js/utils/ui.js',
  '/js/services/storage-service.js',
  '/js/services/prayer-service.js',
  '/js/services/notification-service.js',
  '/js/services/sync-service.js',
  '/js/services/api.js',
  '/js/modules/dashboard.js',
  '/js/modules/deen.js',
  '/js/modules/quran.js',
  '/js/modules/cybersecurity.js',
  '/js/modules/english.js',
  '/js/modules/fitness.js',
  '/js/modules/sleep.js',
  '/js/modules/goals.js',
  '/js/modules/reviews.js',
  '/js/modules/progress.js',
  '/js/modules/settings.js',
  '/js/app.js'
];

// Install Event: Cache Core App Shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache assets safely one by one to avoid all-or-nothing failures
      for (const url of STATIC_ASSETS) {
        try {
          await cache.add(url);
        } catch (e) {
          console.warn('[SW] Cache add warning for:', url, e);
        }
      }
    })
  );
});

// Activate Event: Cleanup Old Caches & Claim Clients Immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Navigation fallback + Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Bypass Google Apps Script & external APIs
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleapis.com')) {
    return;
  }

  // 1. Navigation Requests (HTML Page load / PWA Launch)
  if (event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copy);
              cache.put('/', copy.clone());
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline / Error fallback: match root or index.html
          const cached = await caches.match(event.request) || await caches.match('/') || await caches.match('/index.html');
          if (cached) return cached;
          return new Response('<h1>BATMAN Offline</h1><p>Please reopen the app when connection is restored.</p>', {
            headers: { 'Content-Type': 'text/html' }
          });
        })
    );
    return;
  }

  // 2. Static Assets (CSS, JS, Icons, Images) -> Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If network fetch fails, return cached response if available
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
