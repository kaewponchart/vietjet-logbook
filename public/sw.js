/* ────────────────────────────────────────────────────────────────────────
   TVJ Experience Individual Logbook — Service Worker
   Goal: make the app installable (PWA) WITHOUT making cache-staleness worse.

   Strategy
   • App shell (index.html + icons + manifest): NETWORK-FIRST.
       → When online you always get the freshest GitHub Actions deploy.
       → The cached copy is only a fallback for when the phone is offline.
   • Firebase SDK (gstatic) + Firestore/Auth network calls: NOT intercepted.
       → Realtime data & Google login always go straight to the network.

   When you change icons/manifest, bump CACHE_VERSION below so old caches
   are cleared on next visit. (Normal HTML deploys don't need a bump — the
   network-first rule already serves the newest index.html.)
   ──────────────────────────────────────────────────────────────────────── */

const CACHE_VERSION = 'tvj-logbook-v1';           // ← bump when icons/manifest change
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon-32.png'
];

// Install: pre-cache the shell, take over immediately.
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(SHELL)).catch(() => {})
  );
});

// Activate: drop any old cache versions, control open tabs.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;

  // Only handle GET.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Let anything cross-origin (Firebase SDK on gstatic, Firestore/Auth APIs,
  // Google avatars, etc.) go straight to the network — don't touch it.
  if (url.origin !== self.location.origin) return;

  // Same-origin (our app shell) → network-first, cache as fallback.
  e.respondWith(
    fetch(req)
      .then((res) => {
        // Refresh the cached copy in the background.
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(req).then(
          (hit) => hit || caches.match('./index.html')
        )
      )
  );
});
