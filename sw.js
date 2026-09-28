// Offline-first app shell: the rule-based scam check, emergency checklist and
// Evidence Vault keep working without a network. /api calls (POST) pass through.
const CACHE = 'rakshanet-v3';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'lib/ledger.js', 'lib/scam-rules.js', 'lib/complaint.js', 'assets/logo.svg', 'manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Same-origin: network first (always fresh when online), cache as fallback.
// Cross-origin requests are left to the browser.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))),
  );
});
