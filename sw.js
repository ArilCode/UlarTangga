// Service Worker - Ular Tangga v11.0.21 - PERMANENT INSTALL
const CACHE = "ular-v11.0.21";
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
  "./images/apple-touch-icon.png"
];

const GOOGLE_FONT_CSS = "https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&display=swap";

self.addEventListener("install", e => {
  console.log("[SW] Install - Download SEMUA langsung permanen");
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      
      // 1. Cache file lokal dulu - ini wajib berhasil
      await cache.addAll(ASSETS);
      
      // 2. Cache Google Fonts + file aslinya langsung pas install
      try {
        // Ambil CSS nya
        const cssRes = await fetch(GOOGLE_FONT_CSS);
        const cssText = await cssRes.text();
        // Simpan CSS nya
        await cache.put(GOOGLE_FONT_CSS, new Response(cssText, {
          headers: { 'Content-Type': 'text/css' }
        }));
        
        // Cari semua link woff2 di dalam CSS nya dan download semua
        const fontUrls = [...cssText.matchAll(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/g)].map(m => m[1]);
        console.log("[SW] Nge-cache font asli:", fontUrls);
        
        await Promise.all(fontUrls.map(async (url) => {
          try {
            const fontRes = await fetch(url, { mode: 'cors' });
            if (fontRes.ok) await cache.put(url, fontRes);
          } catch {}
        }));
        
      } catch (err) {
        console.warn("[SW] Gagal cache font pas install, nanti dicoba lagi pas fetch", err);
        // Tetap coba cache CSS nya aja minimal
        try { await cache.add(GOOGLE_FONT_CSS); } catch {}
      }
      
      await self.skipWaiting();
    })()
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
  
  e.respondWith(
    caches.match(e.request).then(cached => {
      // 1. Kalau ada di cache, langsung kasih - ANTI "Anda Offline"
      if (cached) return cached;
      
      // 2. Kalau gak ada, baru online
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200) return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => {
        // 3. Kalau offline total dan gak ada di cache, balikin index.html
        // Jadi gak pernah muncul tulisan "Anda offline" bawaan browser
        return caches.match("./index.html");
      });
    })
  );
});