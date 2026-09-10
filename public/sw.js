/* Bóveda Financiera — Service Worker
 * Estrategia: Stale-While-Revalidate para same-origin GET.
 * La app es 100% local, así que esto sólo cachea el shell (HTML/CSS/JS/íconos).
 */
const CACHE = "boveda-cache-v2";

// El SW se sirve en la raíz del scope: en GitHub Pages de proyecto eso es
// /boveda-financiera/sw.js, en local /sw.js. Derivamos la base de acá para que
// el precache y el fallback offline apunten al lugar correcto.
const BASE = self.location.pathname.replace(/\/sw\.js$/, "");
const START_URL = `${BASE}/`;
const PRECACHE = [
  START_URL,
  `${BASE}/manifest.json`,
  `${BASE}/icon-192.png`,
  `${BASE}/icon-512.png`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);

      if (cached) return cached;

      const fresh = await network;
      if (fresh) return fresh;

      // Fallback de navegación offline
      if (request.mode === "navigate") {
        const shell = await cache.match(START_URL);
        if (shell) return shell;
      }
      return Response.error();
    })
  );
});
