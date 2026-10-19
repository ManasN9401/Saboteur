// Saboteur's service worker: only the offline page. When a page can't be fetched because there's no
// network, it answers with /offline.html (cached with its two photos at install). Nothing else is
// cached or served from here, so the app itself is never served stale. Registered in production by
// components/ServiceWorker.tsx. Bump VERSION when the offline page or its photos change.
const VERSION = "offline-v1";
const OFFLINE = "/offline.html";
const FILES = [OFFLINE, "/offline/desk-day.webp", "/offline/desk-night.webp"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    // Network first, always: the offline page only when the network fails outright.
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }
  // The offline page's own photos, from the cache (only when the network can't supply them).
  const url = new URL(req.url);
  if (url.origin === self.location.origin && FILES.includes(url.pathname)) {
    event.respondWith(fetch(req).catch(() => caches.match(url.pathname)));
  }
});
