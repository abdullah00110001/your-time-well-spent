// Kill-switch: previously this app shipped a service worker.
// This stub unregisters any prior registration and clears caches so
// devices stop serving stale content. Safe to remove after one release.
self.addEventListener('install', (e) => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (e) =>
  e.waitUntil(
    (async () => {
      try {
        await self.clients.claim();
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
        await self.registration.unregister();
      } catch (err) {
        // ignore
      }
    })(),
  ),
);
