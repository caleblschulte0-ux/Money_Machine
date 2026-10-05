// Offline: cache the app and every content file listed in offline.json
// (tools/build_offline.py writes it), then serve from the cache first so the
// tour runs at the park with no signal.
//
// Updating: sw.js itself rarely changes, so the browser would never reinstall
// it. Instead, each time the page is opened with signal, the worker fetches
// offline.json; a new version is downloaded into a fresh cache and swapped in
// once complete. The visitor gets it on the next load.

const LIST = "offline.json";
const PREFIX = "ori-tour-";

async function fill(list) {
  const name = PREFIX + list.version;
  const cache = await caches.open(name);
  await cache.addAll(list.files.map((f) => new Request(f, { cache: "reload" })));
  await cache.put(LIST, new Response(JSON.stringify(list), { headers: { "content-type": "application/json" } }));
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== name).map((k) => caches.delete(k)));
}

let refreshing = null;
function refresh() {
  refreshing = refreshing || (async () => {
    try {
      const list = await fetch(LIST, { cache: "no-store" }).then((r) => r.json());
      if (!(await caches.has(PREFIX + list.version))) await fill(list);
    } catch { /* no signal: keep what we have */ }
    refreshing = null;
  })();
  return refreshing;
}

self.addEventListener("install", (e) => {
  e.waitUntil(refresh().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Safari asks for audio in byte ranges and will not play a cached file
// answered with the whole body, so slice it.
async function ranged(request, response) {
  const m = /bytes=(\d+)-(\d*)/.exec(request.headers.get("range") || "");
  if (!m) return response;
  const buf = await response.arrayBuffer();
  const start = +m[1];
  const end = m[2] ? Math.min(+m[2], buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      "content-type": response.headers.get("content-type") || "application/octet-stream",
      "content-range": `bytes ${start}-${end}/${buf.byteLength}`,
      "content-length": String(end - start + 1),
      "accept-ranges": "bytes",
    },
  });
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (e.request.mode === "navigate") e.waitUntil(refresh());
  e.respondWith((async () => {
    // ignore ?query switches so index.html?sim=1 is served from the cache too
    const hit = await caches.match(e.request, { ignoreSearch: true });
    if (hit) return ranged(e.request, hit);
    try {
      return await fetch(e.request);
    } catch {
      return new Response("Offline and not cached.", { status: 503 });
    }
  })());
});
