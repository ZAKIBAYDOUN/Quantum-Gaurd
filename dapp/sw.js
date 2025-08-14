const CACHE = "supercore-cache-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./utils.js",
  "./manifest.webmanifest",
  "./icon.svg"
];

// Precache
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

// Cleanup
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first, then network fallback
self.addEventListener("fetch", (e) => {
  const req = e.request;
  e.respondWith(
    caches.match(req).then((res) => {
      return res || fetch(req).then((netRes) => {
        const copy = netRes.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return netRes;
      }).catch(() => res);
    })
  );
});
