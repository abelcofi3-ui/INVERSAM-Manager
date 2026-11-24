/*
 * Service worker de INVERSAM Manager.
 * Política: los datos del taller son privados y cambian constantemente, así que NUNCA se
 * guardan páginas ni respuestas de datos en caché. Solo se guarda la página "sin conexión"
 * y los íconos, para mostrar un aviso claro cuando no hay internet.
 */
const CACHE = "inversam-shell-v1";
const SHELL = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Solo navegaciones (abrir/recargar una pantalla); todo lo demás va directo a la red.
  if (req.mode !== "navigate") return;
  event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
});
