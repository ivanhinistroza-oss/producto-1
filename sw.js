const CACHE_NAME = "mostrador-v4";
// librerías de Firebase: se guardan para poder abrir la app sin internet
const SDK_ORIGIN = "https://www.gstatic.com";
const APP_FILES = [
  "./index.html",
  "./mostrador.html",
  "./css/estilos.css",
  "./js/base.js",
  "./js/inventario.js",
  "./js/producto.js",
  "./js/codigos.js",
  "./js/venta.js",
  "./js/impresion.js",
  "./js/notas.js",
  "./js/cotizaciones.js",
  "./js/excel.js",
  "./js/reportes.js",
  "./js/usuarios.js",
  "./js/resumen.js",
  "./js/ventas.js",
  "./js/caja.js",
  "./js/navegacion.js",
  "./js/firebase.js",
  "./js/web.js",
  "./js/cuentas.js",
  "./js/arranque.js",
  "./manifest.json",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_FILES);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("mostrador-") && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  const sdk = url.origin === SDK_ORIGIN && url.pathname.startsWith("/firebasejs/");
  const lector = /^https:\/\/(cdn|fastly)\.jsdelivr\.net$/.test(url.origin) && /^\/npm\/(barcode-detector|zxing-wasm)@/.test(url.pathname);
  if (request.method !== "GET" || (url.origin !== self.location.origin && !sdk && !lector)) return;
  // la página, sus estilos y su código: primero la red (para recibir cambios), sin internet la copia guardada
  if (request.mode === "navigate" || (url.origin === self.location.origin && /\.(?:html|js|css)$/.test(url.pathname))) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return await cache.match(request) || await cache.match("./mostrador.html");
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
