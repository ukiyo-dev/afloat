const APP_VERSION = "1.0.2";
const CACHE_NAME = `afloat-pwa-v${APP_VERSION}`;
const APP_SHELL = ["/offline.html", "/favicon.ico", "/icon.svg", "/manifest.webmanifest"];
const STATIC_CACHE_PATHS = new Set(APP_SHELL);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match("/offline.html"))
    );
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin || !isCacheableStaticRequest(request, url)) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

function isCacheableStaticRequest(request, url) {
  if (
    request.headers.has("RSC") ||
    request.headers.has("Next-Router-State-Tree") ||
    url.searchParams.has("_rsc") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/dashboard") ||
    url.pathname.startsWith("/settings") ||
    url.pathname.startsWith("/login")
  ) {
    return false;
  }

  return url.pathname.startsWith("/_next/static/") || STATIC_CACHE_PATHS.has(url.pathname);
}
