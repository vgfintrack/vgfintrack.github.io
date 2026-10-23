// Service worker: keeps a copy of the app's own files so AmrPotli opens
// without internet. Online, every request goes to the network first, so a
// new version is picked up on the next open; offline (or on a very slow
// connection) the saved copy is used. Google sign-in and Google Drive calls
// are never touched: they always go straight to Google.

const CACHE = 'amrpotli-app-v8';
const NETWORK_TIMEOUT_MS = 4000;

// Everything the app needs to start. Other same-folder files are saved the
// first time they load.
const SHELL = [
  './',
  'index.html',
  'manifest.json',
  'privacy.html',
  'css/style.css',
  'js/app.js',
  'js/calc.js',
  'js/guide.js',
  'js/onboarding.js',
  'js/config.js',
  'js/i18n.js',
  'js/i18n-bn.js',
  'js/lock.js',
  'js/recurring.js',
  'js/reports.js',
  'js/sms.js',
  'js/store.js',
  'vendor/chart.umd.min.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('amrpotli-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Only this app's own files; Google APIs, fonts and everything else pass through.
  if (req.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(new URL('./', self.location).pathname)) return;
  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const network = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
  network.catch(() => {}); // offline: handled below
  try {
    // Wait for the network, but not forever on a weak connection.
    return await Promise.race([
      network,
      new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), NETWORK_TIMEOUT_MS)),
    ]);
  } catch {
    const cached = (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' && (await cache.match('index.html')));
    if (cached) return cached;
    return network; // nothing saved yet: keep waiting for the network
  }
}
