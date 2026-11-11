/**
 * Foto del acta: compresión y cola de subida.
 *
 * Una foto de celular pesa entre 3 y 5 MB. Multiplicada por las casillas de
 * una elección son decenas de gigas, y en datos móviles es una subida que no
 * termina. Se redimensiona a 1600 px de ancho y se guarda en JPEG al 70 %:
 * queda en unos 300 KB y sigue siendo legible para comprobar un número.
 */

/** Ancho máximo. Con 1600 px se lee el número de un acta sin problema. */
const ANCHO_MAXIMO = 1600
const CALIDAD = 0.7

export async function comprimirFoto(archivo: File): Promise<Blob> {
  const imagen = await cargarImagen(archivo)

  const escala = Math.min(1, ANCHO_MAXIMO / imagen.width)
  const ancho = Math.round(imagen.width * escala)
  const alto = Math.round(imagen.height * escala)

  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  const contexto = lienzo.getContext('2d')
  if (!contexto) return archivo

  contexto.drawImage(imagen, 0, 0, ancho, alto)

  return new Promise<Blob>((resolver) => {
    lienzo.toBlob(
      (blob) => resolver(blob ?? archivo),
      'image/jpeg',
      CALIDAD,
    )
  })
}

function cargarImagen(archivo: File): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo)
    const imagen = new Image()
    imagen.onload = () => {
      URL.revokeObjectURL(url)
      resolver(imagen)
    }
    imagen.onerror = () => {
      URL.revokeObjectURL(url)
      rechazar(new Error('No se pudo leer la imagen'))
    }
    imagen.src = url
  })
}

/* ---------------------------------------------------------------------------
 * Cola de fotos sin subir
 * ------------------------------------------------------------------------- */

const BASE = 'sirve-fotos'
const ALMACEN = 'pendientes'
const VERSION = 1

export interface FotoEnCola {
  clave: string
  idCasilla: number
  idEleccion: number
  archivo: Blob
  creado: number
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolver, rechazar) => {
    const peticion = indexedDB.open(BASE, VERSION)
    peticion.onupgradeneeded = () => {
      const bd = peticion.result
      if (!bd.objectStoreNames.contains(ALMACEN)) {
        bd.createObjectStore(ALMACEN, { keyPath: 'clave' })
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

export const claveFoto = (idCasilla: number, idEleccion: number) =>
  `${idCasilla}:${idEleccion}`

export const colaFotos = {
  async guardar(foto: FotoEnCola): Promise<void> {
    await transaccion('readwrite', (a) => a.put(foto))
  },

  async listar(): Promise<FotoEnCola[]> {
    const filas = await transaccion<FotoEnCola[]>('readonly', (a) => a.getAll())
    return filas.sort((x, y) => x.creado - y.creado)
  },

  async contar(): Promise<number> {
    return transaccion<number>('readonly', (a) => a.count())
  },

  async buscar(idCasilla: number, idEleccion: number): Promise<FotoEnCola | null> {
    const fila = await transaccion<FotoEnCola | undefined>('readonly', (a) =>
      a.get(claveFoto(idCasilla, idEleccion)),
    )
    return fila ?? null
  },

  async eliminar(idCasilla: number, idEleccion: number): Promise<void> {
    await transaccion('readwrite', (a) => a.delete(claveFoto(idCasilla, idEleccion)))
  },
}
