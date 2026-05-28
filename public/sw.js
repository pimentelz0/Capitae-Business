// A simplified Service Worker to keep the app PWA-installable, without aggressive and buggy caching that causes stale deployment issues.
const CACHE_NAME = 'capitae-pwa-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          return caches.delete(cache);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Pass-through fetch handler for fresh data & no stale resources
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// Click handling for mobile/desktop native notifications in the phone's notification tray
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Address that the web app is running stand-alone
  const targetUrl = self.location.origin + '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab/standalone window if open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === targetUrl || client.url.startsWith(targetUrl)) {
          if ('focus' in client) {
            return client.focus();
          }
        }
      }
      // Otherwise list and open fresh window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

