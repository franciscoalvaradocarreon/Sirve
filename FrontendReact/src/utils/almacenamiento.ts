/**
 * Almacenamiento del teléfono.
 *
 * El navegador puede vaciar los datos guardados por la aplicación —la cola de
 * capturas incluidas— si le falta espacio, y lo hace sin preguntar. Pedir
 * almacenamiento persistente reduce mucho ese riesgo: el sistema se compromete
 * a no borrarlo salvo que el usuario lo pida.
 *
 * No es una garantía absoluta: el usuario siempre puede limpiar los datos del
 * navegador. Pero pasa de «se puede borrar cuando quiera» a «no se borra por
 * falta de espacio».
 */
export async function pedirPersistencia(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export interface EstadoAlmacenamiento {
  persistente: boolean
  /** Lo que ocupa la aplicación, en bytes. */
  uso: number
  /** Lo que el navegador permite, en bytes. */
  cuota: number
}

export async function estadoAlmacenamiento(): Promise<EstadoAlmacenamiento | null> {
  if (!navigator.storage?.estimate) return null
  try {
    const [persistente, estimacion] = await Promise.all([
      navigator.storage.persisted?.() ?? Promise.resolve(false),
      navigator.storage.estimate(),
    ])
    return {
      persistente,
      uso: estimacion.usage ?? 0,
      cuota: estimacion.quota ?? 0,
    }
  } catch {
    return null
  }
}

/** «1.4 MB» a partir de bytes. */
export function formatearBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
