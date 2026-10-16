/* Bóveda Financiera — Service Worker
 * Estrategia: red primero para las navegaciones (el HTML decide qué JS se
 * carga: si sale del caché, el dispositivo queda con código viejo y puede
 * pisar datos del sync) y Stale-While-Revalidate para el resto de same-origin GET.
 * La app es 100% local, así que esto sólo cachea el shell (HTML/CSS/JS/íconos).
 *
 * __BUILD_ID__ lo reemplaza scripts/stamp-sw.js con un valor único en cada
 * build — sin esto, el navegador ve este archivo byte-a-byte igual al ya
 * instalado y nunca dispara un nuevo install/activate, así que el shell
 * cacheado (HTML/JS/íconos viejos) queda pegado para siempre sin importar
 * cuántos deploys nuevos se hagan.
 */
const CACHE = "boveda-cache-__BUILD_ID__";

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

// Notificaciones push de recordatorios — el payload lo arma la Edge Function
// de Supabase (supabase/functions/send-recordatorios), no esta app.
self.addEventListener("push", (event) => {
  let datos = { title: "Huella", body: "Tenés un recordatorio." };
  try {
    if (event.data) datos = { ...datos, ...event.data.json() };
  } catch {
    /* payload no-JSON, se usa el texto default */
  }

  event.waitUntil(
    self.registration.showNotification(datos.title, {
      body: datos.body,
      icon: `${BASE}/icon-192.png`,
      badge: `${BASE}/icon-192.png`,
      data: { url: datos.url || `${BASE}/recordatorios/` },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || `${BASE}/recordatorios/`;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(BASE) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copia = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copia));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE);
          return (
            (await cache.match(request)) ||
            (await cache.match(START_URL)) ||
            Response.error()
          );
        })
    );
    return;
  }

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
