// LabNotes PWA Service Worker v3.1
const CACHE_NAME = "labnotes-v3.1";

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./clinical.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./manual/index.html"
];

// Network-First files (always try to get fresh)
const FRESH_ASSETS = [
  "./app.js",
  "./clinical.js",
  "./index.html",
  "./lab_catalog.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isFresh = FRESH_ASSETS.some(asset => url.pathname.endsWith(asset.replace('./', '')));

  if (isFresh) {
    // Network First
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache First
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(res => {
          const copy = res.clone();
          if (event.request.method === "GET" && url.origin === location.origin) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return res;
        });
      })
    );
  }
});
