/* Bump this on every release that touches a cached asset. CSS and JS
   are served cache-first, so without a bump a returning user keeps the
   old build until the cache is cleared by hand. */
const CACHE = 'kd-fit-v16';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/app.js',
  './js/native.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon.svg',
  './fonts/instrument-sans-0.woff2',
  './fonts/instrument-sans-1.woff2',
  './icons/jot.svg',
  './img/intro.jpg'
];

self.addEventListener('install', (e) => {
  // One missing asset must not fail the whole install.
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.allSettled(ASSETS.map((a) => c.add(a)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Navigations go network-first so a deploy shows up on the next launch;
// the cached shell is the offline fallback. Everything else is
// cache-first — fonts, icons and art don't change without a cache bump.
self.addEventListener('fetch', (e) => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});

// Local notification, posted by the app.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body } = event.data;
    self.registration.showNotification(title, {
      body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: 'kd-fit-reminder'
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      if (clientList.length > 0) return clientList[0].focus();
      return self.clients.openWindow('./index.html');
    })
  );
});

// The daily reminder from the scheduled GitHub Action.
self.addEventListener('push', (event) => {
  let data = { title: 'Jotara', body: 'Log the day before it resets.' };
  try { if (event.data) data = event.data.json(); } catch (e) { /* keep default */ }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: 'kd-fit-reminder'
    })
  );
});
