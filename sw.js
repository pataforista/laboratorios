// LabNotes PWA Service Worker v5.0
const CACHE_NAME = "labnotes-v5.0";

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./clinical.js",
  "./manualLoader.js",
  "./lab_catalog.json",
  "./export_templates.json",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./manual/dataset/manifest.json",
  "./manual/dataset/printables/generated_index.json"
];

// Assets that should always try to update first
const NETWORK_FIRST_ASSETS = [
  "app.js",
  "clinical.js",
  "manualLoader.js",
  "styles.css",
  "index.html",
  "lab_catalog.json",
  "export_templates.json",
  "manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Pre-caching static assets");
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => {
        if (k !== CACHE_NAME) {
          console.log("[SW] Deleting old cache:", k);
          return caches.delete(k);
        }
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isInternal = url.origin === location.origin;
  
  if (!isInternal) return;

  const pathName = url.pathname;
  const fileName = pathName.split('/').pop();

  // Dataset JSON: Stale-While-Revalidate (always try to update in background)
  if (pathName.includes("/manual/dataset/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          const fetchPromise = fetch(event.request).then(res => {
            if (res.ok && event.request.method === "GET") {
              cache.put(event.request, res.clone());
            }
            return res;
          }).catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // Media assets (PDFs and infografias): Cache-First
  if (pathName.includes("/manual/pdfs/") || pathName.includes("/manual/infografias/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(res => {
            if (res.ok && event.request.method === "GET") {
              cache.put(event.request, res.clone());
            }
            return res;
          });
        })
      )
    );
    return;
  }

  const isNetworkFirst = NETWORK_FIRST_ASSETS.includes(fileName) || pathName.endsWith('/');

  if (isNetworkFirst) {
    // Network First strategy
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
    // Cache First / Stale While Revalidate
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(res => {
          const copy = res.clone();
          if (event.request.method === "GET") {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return res;
        }).catch(() => {});
        return cached || fetchPromise;
      })
    );
  }
});
