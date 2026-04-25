// LabNotes PWA Service Worker v4.1
const CACHE_NAME = "labnotes-v4.1";

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./clinical.js",
  "./lab_catalog.json",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./manual/index.html",
  "./manual/dataset/manifest.json",
  "./manual/dataset/printables/generated_index.json",
  "./manual/assets/index-DnpFSY7c.js",
  "./manual/assets/index-C9eFa_mk.css"
];

// Assets that should always try to update
const NETWORK_FIRST_ASSETS = [
  "app.js",
  "clinical.js",
  "styles.css",
  "index.html",
  "lab_catalog.json",
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

  const fileName = url.pathname.split('/').pop();
  const isNetworkFirst = NETWORK_FIRST_ASSETS.includes(fileName) || url.pathname.endsWith('/');

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
