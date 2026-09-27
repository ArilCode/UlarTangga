// Service Worker - Ular Tangga v11.0.19 - Offline with Fonts + OFFLINE FIRST INSTALL
const CACHE = "ular-v11.0.19";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./main.js",
  "./site.webmanifest",
  "./images/favicon-96x96.png",
  "./images/favicon.svg",
  "./images/favicon.ico",
  "./images/web-app-manifest-192x192.png",
  "./images/web-app-manifest-512x512.png",
  "./images/apple-touch-icon.png",
  "https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&display=swap"
];

self.addEventListener("install", e => {
  console.log("[SW] Install - download cache langsung");
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
    .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(k =>
      Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== 'GET') return;
  
  const url = e.request.url;
  
  // Strategy untuk Google Fonts - Cache First (logic lama sw1 dipertahankan)
  if (url.includes("fonts.googleapis.com") || url.includes("fonts.gstatic.com")) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        try {
          const res = await fetch(e.request);
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        } catch {
          return cached;
        }
      })
    );
    return;
  }
  
  // Logic baru dari sw2 - Cache First + Dynamic Cache + Navigate Fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200) return res;
        const resClone = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, resClone));
        return res;
      }).catch(() => {
        if (e.request.mode === 'navigate') {
          return caches.match("./index.html");
        }
      });
    })
  );
});