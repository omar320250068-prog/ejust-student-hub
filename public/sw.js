/* E-JUST Student Hub service worker. Never intercepts /api/* requests. */
const VERSION = "ejust-hub-v2";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const CORE_PAGES = new Set(["/today", "/timetable", "/exams", "/gpa", "/prerequisites", "/master-plan"]);
const STATIC_FILE = /\.(?:svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot)$/i;

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070d1a;color:#e2e8f0;font:16px system-ui,sans-serif;text-align:center;padding:24px}button{margin-top:16px;padding:10px 18px;border:0;border-radius:10px;background:#22d3ee;color:#070d1a;font-weight:700;cursor:pointer}</style></head><body><div><h1>You're offline</h1><p>Open a saved page or reconnect to load the latest data.</p><button onclick="location.reload()">Try again</button></div></body></html>`;

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/fonts/") ||
    STATIC_FILE.test(pathname)
  );
}

function mayCache(response) {
  if (!response || !response.ok || response.type !== "basic") return false;
  const control = response.headers.get("cache-control") || "";
  return !/\bno-store\b/i.test(control);
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (mayCache(response)) {
      try {
        await cache.put(request, response.clone());
      } catch {
        // A full or unavailable cache must not break the request.
      }
    }
    return response;
  } catch {
    return cached || Response.error();
  }
}

async function networkFirst(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    if (mayCache(response)) {
      try {
        await cache.put(request, response.clone());
      } catch {
        // Ignore quota errors; the page still loads from the network.
      }
    }
    return response;
  } catch {
    const cached = (await cache.match(request)) || (await cache.match("/today"));
    if (cached) return cached;
    return new Response(OFFLINE_HTML, {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(["/icons/icon-192.png", "/icons/icon-512.png"]))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== PAGE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.mode === "navigate" && CORE_PAGES.has(url.pathname)) {
    event.respondWith(networkFirst(request));
  }
});
