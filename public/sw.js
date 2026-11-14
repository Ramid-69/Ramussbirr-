// CBEBirr Service Worker for Instant Offline PWA Support & Live Updates
const CACHE_NAME = 'cbebirr-cache-v11';
const IS_DEV_HOST =
  self.location.hostname.startsWith('ais-dev-') ||
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1';

const STATIC_ASSETS = [
  '/',
  '/messages',
  '/download',
  '/official-receipt',
  '/aureceipt',
  '/manifest.json',
  '/screens/official_receipt_hq.png',
  '/assets/cbe_qr_center_badge_crisp.png',
  '/assets/cbe_transfer_logo_static.png',
  '/assets/cbe_transfer_ring_spinner.png',
  '/assets/aistudio/cbe_transfer_logo_static.png',
  '/assets/aistudio/cbe_transfer_ring_spinner.png',
  '/assets/aistudio/white_card_services_clean.png',
  '/assets/aistudio/white_card_top_authentic.png',
  '/screens/floating_qr_clean.png',
  '/screens/screen_1_splash.png',
  '/screens/screen_2_phone_clean.png',
  '/screens/screen_3_pin.png',
  '/screens/screen_cbe_send_money_clean.png',
  '/screens/screen_send_money_phone.png',
  '/screens/send_money_options_popup_rounded.png',
  '/screens/home_bottom_nav.png',
  '/screens/receipt_page.png',
  '/screens/confirm_pin_page.png',
  '/screens/screen_transfer_pin_clean.png',
  '/screens/transaction_detail.png'
];

self.addEventListener('install', (event) => {
  if (IS_DEV_HOST) {
    self.skipWaiting();
    return;
  }
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        STATIC_ASSETS.map((asset) =>
          cache.add(asset).catch(() => null)
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (IS_DEV_HOST || key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (IS_DEV_HOST) {
    return;
  }

  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests, dynamic API endpoints, or APK binaries
  if (
    req.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/download/') ||
    url.pathname.endsWith('.apk')
  ) {
    return;
  }

  // Immutable hashed Next.js JS/CSS chunks: Cache-First ONLY when content-hashed (never unhashed dev chunks)
  if (url.pathname.startsWith('/_next/static/')) {
    const isContentHashed =
      /[.-][0-9a-f]{8,}\.(js|css|woff2?|png|svg|ico)$/i.test(url.pathname) ||
      url.hostname.includes('appassets.androidplatform.net');

    if (!isContentHashed || url.searchParams.has('v')) {
      event.respondWith(
        fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            }
            return networkResponse;
          })
          .catch(() => caches.match(req))
      );
      return;
    }

    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Static images/screens: Stale-While-Revalidate (instant display + automatic background update)
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/screens/')) {
    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        const fetchPromise = fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Network-First for HTML pages & navigation (ensures APK always gets newest UI when online, falls back to cache offline)
  event.respondWith(
    fetch(req)
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
        return caches.match(req, { ignoreSearch: true }).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (req.mode === 'navigate') {
            if (url.pathname.startsWith('/messages')) {
              return caches.match('/messages', { ignoreSearch: true }) || caches.match('/');
            }
            if (url.pathname.startsWith('/official-receipt')) {
              return caches.match('/official-receipt', { ignoreSearch: true }) || caches.match('/');
            }
            if (url.pathname.startsWith('/aureceipt')) {
              return caches.match('/aureceipt', { ignoreSearch: true }) || caches.match('/');
            }
            return caches.match('/');
          }
          return undefined;
        });
      })
  );
});
