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

// ── Web Push ────────────────────────────────────────────────────────────────
// The payload is JSON built server-side by src/lib/push.ts: {title, body,
// url, tag}. `tag` coalesces repeat pushes about the same thing (three likes
// on one post replace each other instead of stacking three banners).
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // A malformed payload still shows a generic notification below.
  }
  const title = payload.title || "mesh.me";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-128x128.png",
      tag: payload.tag || undefined,
      data: { url: payload.url || "/notifications" },
    }),
  );
});

// Tapping the notification lands on the thing it announced — an existing
// mesh.me window if one is open, a fresh one otherwise.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/notifications";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
