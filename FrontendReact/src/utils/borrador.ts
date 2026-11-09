/**
 * Borrador de la captura en curso.
 *
 * Si se refresca la pantalla —o el teléfono cierra la pestaña por falta de
 * memoria— se perdía todo lo escrito. Los votos se guardan aquí conforme se
 * escriben y se recuperan al volver.
 *
 * Se usa sessionStorage y no localStorage a propósito: el borrador pertenece a
 * la sesión de trabajo. Si mañana se abre la aplicación para capturar otra
 * casilla, no debe aparecer el borrador de ayer.
 */
const PREFIJO = 'sirve:borrador:'

export interface Borrador {
  votos: Record<number, string>
  totalActa: string
  nulos: string
  noRegistrados: string
}

export function claveBorrador(idCasilla: number, idEleccion: number) {
  return `${PREFIJO}${idCasilla}:${idEleccion}`
}

export function guardarBorrador(clave: string, borrador: Borrador) {
  try {
    sessionStorage.setItem(clave, JSON.stringify(borrador))
  } catch {
    // Sin espacio: se pierde el borrador, pero la captura sigue funcionando.
  }
}

export function leerBorrador(clave: string): Borrador | null {
  try {
    const guardado = sessionStorage.getItem(clave)
    return guardado ? (JSON.parse(guardado) as Borrador) : null
  } catch {
    return null
  }
}

export function limpiarBorrador(clave: string) {
  try {
    sessionStorage.removeItem(clave)
  } catch {
    // Nada que hacer.
  }
}
