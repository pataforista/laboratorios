// LabNotes PWA Service Worker v4.0
const CACHE_NAME = "labnotes-v4.0";

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./clinical.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./manual/index.html",
  "./manual/assets/index-DnpFSY7c.js",
  "./manual/assets/index-C9eFa_mk.css",
  "./manual/dataset/manifest.json",
  "./manual/dataset/printables/generated_index.json"
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
  // Ensure that HTML, JS, CSS, JSON always try Network First. 
  // This explicitly prevents the app from being stuck on old versions or 404ing due to stale Vite chunks.
  const isFresh = FRESH_ASSETS.some(asset => url.pathname.endsWith(asset.replace('./', ''))) ||
                  url.pathname.endsWith('.html') ||
                  url.pathname.endsWith('.js') ||
                  url.pathname.endsWith('.css') ||
                  url.pathname.endsWith('.json') ||
                  url.pathname.endsWith('/');

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
    // Stale While Revalidate for images/fonts/other media
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(res => {
          const copy = res.clone();
          if (event.request.method === "GET" && url.origin === location.origin) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return res;
        }).catch(() => {});
        return cached || fetchPromise;
      })
    );
  }
});
