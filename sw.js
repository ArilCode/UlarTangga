// Service Worker - Ular Tangga v11.0.3
const CACHE = "ular-v11.0.3";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./main.js",
  "./site.webmanifest",
  // IMAGE ASSETS - Add all your local images here for offline
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
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))));
});

self.addEventListener("fetch", e => {
  // Cache Google Fonts for offline use
  if (e.request.url.includes("fonts.googleapis.com") || e.request.url.includes("fonts.gstatic.com")) {
    e.respondWith(
      caches.open(CACHE).then(cache => cache.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        cache.put(e.request, res.clone());
        return res;
      })))
    );
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match("./index.html"))));
});