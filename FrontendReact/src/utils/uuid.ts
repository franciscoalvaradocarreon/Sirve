/**
 * Identificador único para la llave de idempotencia de la captura.
 *
 * `crypto.randomUUID` solo existe en **contexto seguro**: HTTPS o localhost.
 * Servido por IP y HTTP —como está hoy el servidor— la función no existe y
 * el navegador lanza «crypto.randomUUID is not a function» justo al guardar.
 *
 * `crypto.getRandomValues` sí está disponible en contexto no seguro, así que
 * se arma el UUID a mano con la versión y la variante que pide la RFC 4122.
 * El último recurso es Math.random, que no es criptográfico pero basta: de lo
 * que se trata es de que dos capturas simultáneas no colisionen.
 */
export function nuevoUuid(): string {
  const c = globalThis.crypto

  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID()
  }

  const bytes = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40 // versión 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variante RFC 4122

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-')
}
