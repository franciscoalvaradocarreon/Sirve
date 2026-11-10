/**
 * El pase del teléfono.
 *
 * Es lo que identifica a este aparato ante el servidor. Se obtiene una sola
 * vez, escaneando el código que le dieron al capturista, y desde entonces
 * viaja en cada petición.
 *
 * Se guarda en localStorage y no en sessionStorage a propósito: si se
 * perdiera al cerrar el navegador, el capturista tendría que volver a
 * enrolarse cada vez.
 */
const CLAVE_PASE = 'sirve:pase'
const CLAVE_NOMBRE = 'sirve:capturista'

export interface Sesion {
  pase: string
  nombre: string
}

export function guardarSesion(sesion: Sesion) {
  try {
    localStorage.setItem(CLAVE_PASE, sesion.pase)
    localStorage.setItem(CLAVE_NOMBRE, sesion.nombre)
  } catch {
    // Sin almacenamiento el enrolamiento dura lo que dure la pestaña.
  }
}

export function leerSesion(): Sesion | null {
  try {
    const pase = localStorage.getItem(CLAVE_PASE)
    if (!pase) return null
    return { pase, nombre: localStorage.getItem(CLAVE_NOMBRE) ?? '' }
  } catch {
    return null
  }
}

/** El pase suelto, que es lo que necesita el cliente HTTP. */
export function leerPase(): string | null {
  try {
    return localStorage.getItem(CLAVE_PASE)
  } catch {
    return null
  }
}

export function borrarSesion() {
  try {
    localStorage.removeItem(CLAVE_PASE)
    localStorage.removeItem(CLAVE_NOMBRE)
  } catch {
    // Nada que hacer.
  }
}
