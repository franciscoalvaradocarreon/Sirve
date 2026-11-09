/* ============================================================================
 * SIRVE · Service worker
 *
 * Objetivo: que la aplicación abra sin conexión. En una casilla no hay señal y
 * la pantalla tiene que cargar igual, con lo último que se descargó.
 *
 * Reglas:
 *   · Las rutas de la API nunca se cachean. Un dato electoral servido desde la
 *     caché sería peor que un error: parecería bueno y estaría viejo.
 *   · Las navegaciones van a la red primero; si no hay, se entrega el
 *     index.html guardado y React resuelve la ruta.
 *   · Los archivos con hash en el nombre (los del build) van a la caché
 *     primero: si el nombre cambió, es otro archivo.
 * ==========================================================================*/

const CACHE = 'sirve-v1'
const INDICE = '/index.html'

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(['/', INDICE]))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request

  if (peticion.method !== 'GET') return

  const url = new URL(peticion.url)

  // Otro origen (por ejemplo, un servicio externo): no se toca.
  if (url.origin !== self.location.origin) return

  // La API y el actuator siempre van a la red.
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/actuator')) return

  // Navegación: red primero, caché como respaldo.
  if (peticion.mode === 'navigate') {
    evento.respondWith(
      fetch(peticion)
        .then((respuesta) => {
          const copia = respuesta.clone()
          caches.open(CACHE).then((cache) => cache.put(INDICE, copia))
          return respuesta
        })
        .catch(() => caches.match(INDICE).then((guardado) => guardado || Response.error())),
    )
    return
  }

  // Archivos estáticos: caché primero.
  evento.respondWith(
    caches.match(peticion).then(
      (guardado) =>
        guardado ||
        fetch(peticion).then((respuesta) => {
          if (respuesta.ok) {
            const copia = respuesta.clone()
            caches.open(CACHE).then((cache) => cache.put(peticion, copia))
          }
          return respuesta
        }),
    ),
  )
})
