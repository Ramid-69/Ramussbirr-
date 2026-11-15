// CBEBirr Service Worker for Instant Offline PWA Support & Automatic Live OTA Updates
const CACHE_NAME = 'cbebirr-cache-v12';
const IS_DEV_HOST =
  self.location.hostname.startsWith('ais-dev-') ||
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1';

const STATIC_ASSETS = [
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
  '/screens/transaction_detail.png',
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
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (data.type === 'CLEAR_ALL_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
});

self.addEventListener('fetch', (event) => {
  if (IS_DEV_HOST) {
    return;
  }

  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests, dynamic API endpoints, SW script itself, or APK binaries
  if (
    req.method !== 'GET' ||
    url.pathname === '/sw.js' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/download/') ||
    url.pathname.endsWith('.apk')
  ) {
    return;
  }

  // Immutable hashed Next.js JS/CSS chunks: Cache-First ONLY when content-hashed
  if (url.pathname.startsWith('/_next/static/')) {
    const isContentHashed =
      /[.-][0-9a-f]{8,}\.(js|css|woff2?|png|svg|ico)$/i.test(url.pathname) ||
      url.hostname.includes('appassets.androidplatform.net');

    if (!isContentHashed || url.searchParams.has('v')) {
      event.respondWith(
        fetch(new Request(req.url, { cache: 'no-store', credentials: 'same-origin' }))
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

  // Static images/screens: Stale-While-Revalidate
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

  // Network-First (with cache: 'no-store') for HTML pages & navigation so APK always loads latest Vercel deploy when online
  const isNavigation =
    req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  event.respondWith(
    fetch(
      isNavigation
        ? new Request(req.url, { cache: 'no-store', credentials: 'same-origin' })
        : req
    )
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          const cacheKey = isNavigation ? url.pathname : req;
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(cacheKey, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(url.pathname, { ignoreSearch: true }).then((cachedByPath) => {
          if (cachedByPath) return cachedByPath;
          return caches.match(req, { ignoreSearch: true }).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            if (isNavigation) {
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
        });
      })
  );
});
