/*
 * KudiLens service worker. Keeps the app shell installable and usable on a flaky connection:
 *  - page navigations: network first, falling back to the last copy, then /offline.html
 *  - hashed build assets, fonts and icons: cache first (their URLs change when they change)
 *  - everything else (API calls, Supabase, AI) always goes to the network and is never cached,
 *    so personal financial data is never stored by the worker.
 */
const VERSION = "kudilens-v1";
const SHELL = ["/offline.html", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isStatic = (url) =>
  (url.origin === self.location.origin && (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/"))) ||
  url.origin === "https://fonts.googleapis.com" ||
  url.origin === "https://fonts.gstatic.com";

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put("/__last-page", copy));
          }
          return res;
        })
        .catch(async () => (await caches.match("/__last-page")) || (await caches.match("/offline.html"))),
    );
    return;
  }

  if (isStatic(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok || res.type === "opaque") {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
});
