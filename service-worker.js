const CACHE_NAME = 'batman-v1-cache-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/icons/icon.svg',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/themes.css',
  './js/config.js',
  './js/utils/dates.js',
  './js/utils/calculations.js',
  './js/utils/validation.js',
  './js/utils/ui.js',
  './js/services/storage-service.js',
  './js/services/prayer-service.js',
  './js/services/notification-service.js',
  './js/services/sync-service.js',
  './js/services/api.js',
  './js/modules/dashboard.js',
  './js/modules/deen.js',
  './js/modules/quran.js',
  './js/modules/cybersecurity.js',
  './js/modules/english.js',
  './js/modules/fitness.js',
  './js/modules/sleep.js',
  './js/modules/goals.js',
  './js/modules/reviews.js',
  './js/modules/progress.js',
  './js/modules/settings.js',
  './js/app.js'
];

// Install Event: Pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching partial warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Cleanup stale caches
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

// Fetch Event: Stale-While-Revalidate for app assets, Network-only for API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Do not cache Google Apps Script API calls or external dynamic requests
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleapis.com')) {
    return;
  }

  // Handle local GET requests with Stale-While-Revalidate
  if (event.request.method === 'GET') {
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
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
