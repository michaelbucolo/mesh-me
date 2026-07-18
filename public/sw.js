// mesh.me service worker — installability + a graceful offline shell.
// Deliberately conservative: static assets are cached, page navigations are
// network-first with an offline fallback, and /api is NEVER touched, so
// nothing personal is ever written to CacheStorage.
const VERSION = "mesh-sw-v1";
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/meshi-icon.svg", "/icons/icon-192x192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Page navigations: always try the live site; the offline page is the net.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((hit) => hit || Response.error()),
      ),
    );
    return;
  }

  // Immutable build assets + icons: cache-first.
  const cacheable =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".woff2");
  if (!cacheable) return;

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
