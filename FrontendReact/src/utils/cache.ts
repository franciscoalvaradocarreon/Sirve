/**
 * Caché de catálogos para poder capturar sin conexión.
 *
 * El problema real: se llega a la casilla sin señal y la pantalla necesita los
 * municipios, la sección, las casillas y la boleta para poder capturar. Si esos
 * datos solo viven en el servidor, no hay forma de avanzar.
 *
 * Cada consulta que sale bien se guarda; si falla por falta de red, se devuelve
 * lo último que se guardó. No es una base de datos local: es la memoria de lo
 * que ya se consultó alguna vez en este teléfono.
 */
const PREFIJO = 'sirve:'

export async function conCache<T>(clave: string, cargar: () => Promise<T>): Promise<T> {
  try {
    const datos = await cargar()
    try {
      localStorage.setItem(PREFIJO + clave, JSON.stringify(datos))
    } catch {
      // Sin espacio o almacenamiento bloqueado: se sigue sin cachear.
    }
    return datos
  } catch (error) {
    try {
      const guardado = localStorage.getItem(PREFIJO + clave)
      if (guardado) return JSON.parse(guardado) as T
    } catch {
      // Si el guardado está corrupto, se usa el error original.
    }
    throw error
  }
}

/** true si hay algo guardado para esa clave. */
export function hayCache(clave: string): boolean {
  try {
    return localStorage.getItem(PREFIJO + clave) !== null
  } catch {
    return false
  }
}
