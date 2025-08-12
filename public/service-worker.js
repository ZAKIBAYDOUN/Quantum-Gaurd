/* simple service worker: cache-first for static assets */
const CACHE = "5470-cache-v1";
const ASSETS = [ "/", "/index.html", "/manifest.json" ];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS).catch(()=>null))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  e.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});