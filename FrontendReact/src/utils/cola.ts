import type { CapturaCrear } from '../types'

/**
 * Cola de capturas hechas sin conexión.
 *
 * En una casilla no hay señal. La captura se guarda en el teléfono y se envía
 * cuando vuelve la red; hasta entonces la pantalla la muestra como pendiente.
 *
 * Se usa IndexedDB y no localStorage: es el almacén pensado para esto, no
 * bloquea la interfaz y aguanta más que los 5 MB de localStorage.
 *
 * La llave es el `id_cliente` que ya viaja en la petición. Eso hace que
 * reenviar dos veces la misma captura no duplique nada: el servidor reconoce
 * el identificador y responde con la captura que ya tenía.
 */

const BASE = 'sirve'
const ALMACEN = 'capturas'
const VERSION = 1

export interface CapturaEnCola {
  id_cliente: string
  creado: number
  /** Texto para mostrar: casilla y municipio. */
  casilla: string
  /** Texto para mostrar: nombre de la elección. */
  eleccion: string
  datos: CapturaCrear
  intentos: number
  error?: string
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolver, rechazar) => {
    const peticion = indexedDB.open(BASE, VERSION)
    peticion.onupgradeneeded = () => {
      const bd = peticion.result
      if (!bd.objectStoreNames.contains(ALMACEN)) {
        bd.createObjectStore(ALMACEN, { keyPath: 'id_cliente' })
      }
    }
    peticion.onsuccess = () => resolver(peticion.result)
    peticion.onerror = () => rechazar(peticion.error)
  })
}

function transaccion<T>(
  modo: IDBTransactionMode,
  accion: (almacen: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return abrir().then(
    (bd) =>
      new Promise<T>((resolver, rechazar) => {
        const tx = bd.transaction(ALMACEN, modo)
        const peticion = accion(tx.objectStore(ALMACEN))
        peticion.onsuccess = () => resolver(peticion.result)
        peticion.onerror = () => rechazar(peticion.error)
        tx.oncomplete = () => bd.close()
      }),
  )
}

export const cola = {
  async encolar(captura: CapturaEnCola): Promise<void> {
    await transaccion('readwrite', (a) => a.put(captura))
  },

  async listar(): Promise<CapturaEnCola[]> {
    const filas = await transaccion<CapturaEnCola[]>('readonly', (a) => a.getAll())
    return filas.sort((x, y) => x.creado - y.creado)
  },

  async contar(): Promise<number> {
    return transaccion<number>('readonly', (a) => a.count())
  },

  /**
   * Captura pendiente de una casilla, si la hay.
   *
   * Hace falta para que la pantalla de captura sepa que ese acta existe en el
   * teléfono aunque el servidor todavía no la tenga: sin esto, volver a la
   * casilla mostraba el formulario vacío y parecía que no se había guardado.
   */
  async buscar(idCasilla: number, idEleccion: number): Promise<CapturaEnCola | null> {
    const filas = await transaccion<CapturaEnCola[]>('readonly', (a) => a.getAll())
    return (
      filas.find(
        (f) =>
          f.datos.id_casilla === idCasilla && f.datos.id_eleccion === idEleccion,
      ) ?? null
    )
  },

  async eliminar(idCliente: string): Promise<void> {
    await transaccion('readwrite', (a) => a.delete(idCliente))
  },

  async marcarError(idCliente: string, error: string): Promise<void> {
    const fila = await transaccion<CapturaEnCola | undefined>('readonly', (a) =>
      a.get(idCliente),
    )
    if (!fila) return
    await transaccion('readwrite', (a) =>
      a.put({ ...fila, intentos: fila.intentos + 1, error }),
    )
  },
}
