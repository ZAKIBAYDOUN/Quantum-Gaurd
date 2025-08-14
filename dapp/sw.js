const CACHE = "supercore-cache-v5";
const ASSETS = [\n  "./",\n  "./index.html",\n  "./ui.css",\n  "./app.js",\n  "./wallets.js",\n  "./multicall.js",\n  "./eip712.js",\n  "./aa4337.js",\n  "./dex.js",\n  "./zk.js",\n  "./mpc.js",\n  "./qnn.js",\n  "./utils.js",\n  "./contracts.json",\n  "./networks.json",\n  "./chains.config.json",\n  "./manifest.webmanifest",\n  "./icon.svg"\n];

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




