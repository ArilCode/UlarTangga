// Service Worker - Ular Tangga v11.0.4 - Offline with Fonts
const CACHE = "ular-v11.0.5";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./main.js",
  "./site.webmanifest",
  "./images/favicon-96x96.png",
  "./images/favicon.svg",
  "./images/favicon.ico",
  "./images/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x))))
    .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = e.request.url;
  
  // Strategy for Google Fonts - Cache First
  if (url.includes("fonts.googleapis.com") || url.includes("fonts.gstatic.com")) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        try {
          const res = await fetch(e.request);
          // Only cache valid responses
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        } catch {
          return cached; // fallback if offline and not cached yet
        }
      })
    );
    return;
  }
  
  // Default: Cache first, then network
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match("./index.html")))
  );
});