/**
 * Foto del acta: compresión y cola de subida.
 *
 * Una foto de celular pesa entre 3 y 5 MB. Multiplicada por las casillas de
 * una elección son decenas de gigas, y en datos móviles es una subida que no
 * termina. Se redimensiona y se guarda en JPEG: queda en unos 300 KB y sigue
 * siendo legible para comprobar un número.
 *
 * Tres cuidados que no se ven:
 *
 * · La orientación. Las fotos de Android traen la rotación en los metadatos
 *   (EXIF), no en los píxeles. Al dibujarlas en un lienzo se pierde ese dato y
 *   el acta sale acostada. `createImageBitmap` con `imageOrientation` la
 *   respeta.
 *
 * · El tamaño se mide por el lado mayor, no por el ancho. Un acta fotografiada
 *   en vertical mide 3024 de alto y 4032 de ancho girada; limitar solo el ancho
 *   deja imágenes de 1600×2100 que pesan más de lo necesario.
 *
 * · Si con la calidad normal el archivo sigue pesando demasiado, se vuelve a
 *   comprimir más fuerte. Es mejor un acta algo borrosa que una subida que
 *   falla en el monte.
 */

/** Lado mayor máximo, en píxeles. Con 1600 se lee el número de un acta. */
const LADO_MAXIMO = 1600

/** Calidad inicial. Da alrededor de 300 KB en un acta bien iluminada. */
const CALIDAD = 0.7

/** Si después del primer intento pesa más que esto, se comprime otra vez. */
const PESO_ACEPTABLE = 400 * 1024
const CALIDAD_DE_EMERGENCIA = 0.5

export interface FotoComprimida {
  archivo: Blob
  ancho: number
  alto: number
}

export async function comprimirFoto(archivo: File): Promise<Blob> {
  const imagen = await cargarImagen(archivo)

  const lado = Math.max(imagen.width, imagen.height)
  const escala = Math.min(1, LADO_MAXIMO / lado)
  const ancho = Math.round(imagen.width * escala)
  const alto = Math.round(imagen.height * escala)

  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  const contexto = lienzo.getContext('2d')

  // Sin contexto no hay compresión posible: se manda el original, que es peor
  // que nada pero mejor que perder la foto.
  if (!contexto) return archivo

  // Fondo blanco: un JPEG no tiene transparencia, y sin fondo las zonas
  // transparentes salen negras.
  contexto.fillStyle = '#ffffff'
  contexto.fillRect(0, 0, ancho, alto)
  contexto.drawImage(imagen, 0, 0, ancho, alto)

  let resultado = await dibujar(lienzo, CALIDAD)
  if (resultado.size > PESO_ACEPTABLE) {
    const segunda = await dibujar(lienzo, CALIDAD_DE_EMERGENCIA)
    if (segunda.size < resultado.size) resultado = segunda
  }

  return resultado
}

function dibujar(lienzo: HTMLCanvasElement, calidad: number): Promise<Blob> {
  return new Promise<Blob>((resolver, rechazar) => {
    lienzo.toBlob(
      (blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo comprimir'))),
      'image/jpeg',
      calidad,
    )
  })
}

/**
 * Carga la imagen respetando su orientación.
 *
 * `createImageBitmap` con `imageOrientation: 'from-image'` aplica la rotación
 * EXIF al bitmap. Los navegadores que no lo soportan caen al método clásico,
 * que deja la foto como esté.
 */
async function cargarImagen(archivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(archivo, { imageOrientation: 'from-image' })
    } catch {
      // Algunos navegadores no aceptan la opción; se intenta sin ella.
      try {
        return await createImageBitmap(archivo)
      } catch {
        // Y si tampoco, se usa el método clásico.
      }
    }
  }

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

/** Tamaño legible: «284 KB» o «1.2 MB». */
export function pesoLegible(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
