// CBEBirr Service Worker for Offline PWA Support
const CACHE_NAME = 'cbebirr-cache-v1';

const STATIC_ASSETS = [
  '/',
  '/download',
  '/official-receipt',
  '/manifest.json',
  '/screens/official_receipt_hq.png',
  '/assets/cbe_qr_center_badge_crisp.png',
  '/assets/cbe_transfer_logo_static.png',
  '/assets/cbe_transfer_ring_spinner.png',
  '/screens/floating_qr_clean.png',
  '/screens/screen_1_splash.png',
  '/screens/screen_2_phone_clean.png',
  '/screens/screen_3_pin.png',
  '/screens/screen_cbe_send_money_clean.png',
  '/screens/screen_send_money_phone.png',
  '/screens/send_money_options_popup_rounded.png',
  '/screens/home_bottom_nav.png',
  '/screens/receipt_page.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Pre-caching some assets failed:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests or dynamic API endpoints
  if (req.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  // Stale-While-Revalidate or Cache-First for static assets & pages
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and page request, fallback to cached root
          if (req.mode === 'navigate') {
            return caches.match('/');
          }
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
