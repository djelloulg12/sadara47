/* ==========================================================
   عامل الخدمة — يخزّن الصدفة ليعمل المسح والاستمارة بلا إنترنت
   ========================================================== */
const CACHE = 'sadara-v2';
const SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/firebase-config.js',
  '/manifest.webmanifest', '/assets/logo.png', '/assets/form-registration-01.jpg',
  '/assets/internal-regulations.jpg', '/assets/registration-card.jpg'];

/* The scans are the only files big enough to be worth serving from the cache on
   sight; they are also the ones the printed form is measured against. */
const BIG_SCAN = /\.(?:jpe?g|png)$/i;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Puts a fresh copy in the cache and hands back the live one. Offline, it hands
   back whatever the last visit stored. */
function networkFirst(req) {
  return caches.open(CACHE).then(cache => cache.match(req).then(cached => {
    return fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => cached || caches.match('/index.html'));
  }));
}

/* Hands back the stored copy straight away and replaces it in the background. */
function staleWhileRevalidate(req) {
  return caches.open(CACHE).then(cache => cache.match(req).then(cached => {
    const live = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || live;
  }));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // the API always goes to the network: a stale roster is worse than none
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(req).catch(() => new Response('{"error":"offline"}', {
      status: 503, headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  /* Code first, from the network. The printed form is laid out over the club's
     own scan, so a visitor working from a cached copy of app.js would fill in a
     form that no longer matches the paperwork it is printed onto. */
  if (BIG_SCAN.test(url.pathname)) e.respondWith(staleWhileRevalidate(req));
  else e.respondWith(networkFirst(req));
});