/**
 * Tamaño de letra cómodo.
 *
 * Sube el tamaño base del documento, y como Tailwind mide en rem, todo lo que
 * usa sus clases crece en la misma proporción: títulos, etiquetas, campos y
 * botones. No hay que tocar una sola clase.
 *
 * La preferencia se guarda en el teléfono, porque quien la necesita la
 * necesita siempre: pedirla en cada visita sería una molestia.
 */
const CLAVE = 'sirve:texto-grande'

/** Clase que activa el tamaño grande (definida en index.css). */
const CLASE = 'texto-grande'

export function aplicarTextoGrande(activo: boolean) {
  document.documentElement.classList.toggle(CLASE, activo)
}

export function guardarTextoGrande(activo: boolean) {
  try {
    localStorage.setItem(CLAVE, activo ? '1' : '0')
  } catch {
    // Sin almacenamiento: el ajuste dura lo que dure la sesión.
  }
}

export function leerTextoGrande(): boolean {
  try {
    return localStorage.getItem(CLAVE) === '1'
  } catch {
    return false
  }
}
