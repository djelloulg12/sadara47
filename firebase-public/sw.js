/* ==========================================================
   عامل الخدمة — يخزّن الصدفة ليعمل المسح والاستمارة بلا إنترنت
   ========================================================== */
const CACHE = 'sadara-v1';
const SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/firebase-config.js',
  '/manifest.webmanifest', '/assets/logo.png', '/assets/form-registration-01.jpg',
  '/assets/internal-regulations.jpg', '/assets/registration-card.jpg'];

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

  // the shell: cache first, refresh in the background
  e.respondWith(
    caches.match(req).then(hit => {
      const live = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit || caches.match('/index.html'));
      return hit || live;
    })
  );
});