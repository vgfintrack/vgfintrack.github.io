// FinnBlu moved to /FinnBlu/. This replaces the old app's service worker: it
// clears the old saved copy and steps aside, so this address only forwards.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('amrpotli-')).map((k) => caches.delete(k)));
      await self.registration.unregister();
      const open = await self.clients.matchAll({ type: 'window' });
      open.forEach((c) => c.navigate(c.url).catch(() => {}));
    })(),
  );
});
