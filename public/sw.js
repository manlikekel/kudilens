/*
 * KudiLens service worker.
 *
 * Caching (personal financial data is never stored here):
 *  - page navigations: network first, then the last copy of the app, then /offline.html
 *  - hashed build assets, fonts and icons: cache first (their URLs change when the file changes)
 *  - public market data (/api/funds, /api/ng-funds, /api/market): stale-while-revalidate, so the
 *    Invest page and live assumptions still show the last figures when offline
 *  - everything else (Supabase, the AI advisor, account actions) always goes to the network
 *
 * Background work:
 *  - "sync" (tag refresh-market): refreshes cached market data once the connection is back
 *  - "periodicsync" (tag refresh-market, installed app on Chrome/Android): about once a day
 *
 * Notifications: shows pushed messages and opens the right page when one is tapped. Sending them
 * needs a push server (VAPID keys and subscriptions), which is a separate step.
 */
const VERSION = "kudilens-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-data`;
const SHELL = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon.svg",
];
const MARKET = ["/api/market", "/api/ng-funds", "/api/funds?country=US", "/api/funds?country=GB", "/api/funds?country=CA"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)));
  // activate straight away; pages are told so they can offer a refresh
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

const isStatic = (url) =>
  (url.origin === self.location.origin &&
    (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/"))) ||
  url.origin === "https://fonts.googleapis.com" ||
  url.origin === "https://fonts.gstatic.com";

const isMarketData = (url) =>
  url.origin === self.location.origin &&
  (url.pathname === "/api/market" || url.pathname === "/api/ng-funds" || url.pathname === "/api/funds");

async function refreshMarket() {
  const cache = await caches.open(DATA_CACHE);
  await Promise.all(
    MARKET.map(async (path) => {
      try {
        const res = await fetch(path, { cache: "no-store" });
        if (res.ok) await cache.put(path, res);
      } catch {
        /* still offline: keep the old copy */
      }
    }),
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        try {
          const res = (await event.preloadResponse) || (await fetch(request));
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put("/__last-page", copy));
          }
          return res;
        } catch {
          return (await caches.match("/__last-page")) || (await caches.match("/offline.html"));
        }
      })(),
    );
    return;
  }

  if (isMarketData(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(DATA_CACHE);
        const key = url.pathname + url.search;
        const cached = await cache.match(key);
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(key, res.clone());
            return res;
          })
          .catch(() => null);
        if (cached) {
          event.waitUntil(network);
          return cached;
        }
        return (await network) || new Response(JSON.stringify({ offline: true }), { status: 503 });
      })(),
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
              caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === "refresh-market") event.waitUntil(refreshMarket());
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "refresh-market") event.waitUntil(refreshMarket());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "KudiLens", {
      body: data.body || "You have an update.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || "kudilens",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = open.find((c) => c.url.startsWith(self.location.origin));
      if (existing) {
        await existing.focus();
        return existing.navigate(target);
      }
      return self.clients.openWindow(target);
    })(),
  );
});
