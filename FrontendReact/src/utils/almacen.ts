/**
 * Almacén para catálogos grandes.
 *
 * El listado de secciones y casillas de todo un proceso no cabe con holgura en
 * localStorage: en 2027 son 3 114 secciones y 6 228 casillas, cerca de 1.5 MB.
 * localStorage es síncrono, tiene unos 5 MB por origen y bloquea la interfaz
 * mientras serializa.
 *
 * IndexedDB está pensado para esto: asíncrono, sin ese límite y sin congelar
 * la pantalla. Se guarda un objeto por clave y se lee devolviéndolo tal cual.
 */
const BASE = 'sirve-catalogo'
const ALMACEN = 'valores'
const VERSION = 1

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolver, rechazar) => {
    const peticion = indexedDB.open(BASE, VERSION)
    peticion.onupgradeneeded = () => {
      const bd = peticion.result
      if (!bd.objectStoreNames.contains(ALMACEN)) {
        bd.createObjectStore(ALMACEN)
      }
    }
    peticion.onsuccess = () => resolver(peticion.result)
    peticion.onerror = () => rechazar(peticion.error)
  })
}

export async function guardarCatalogo<T>(clave: string, datos: T): Promise<void> {
  const bd = await abrir()
  await new Promise<void>((resolver, rechazar) => {
    const tx = bd.transaction(ALMACEN, 'readwrite')
    tx.objectStore(ALMACEN).put(datos, clave)
    tx.oncomplete = () => resolver()
    tx.onerror = () => rechazar(tx.error)
  })
  bd.close()
}

export async function leerCatalogo<T>(clave: string): Promise<T | null> {
  const bd = await abrir()
  const datos = await new Promise<T | null>((resolver, rechazar) => {
    const tx = bd.transaction(ALMACEN, 'readonly')
    const peticion = tx.objectStore(ALMACEN).get(clave)
    peticion.onsuccess = () => resolver((peticion.result as T) ?? null)
    peticion.onerror = () => rechazar(peticion.error)
  })
  bd.close()
  return datos
}

export async function hayCatalogo(clave: string): Promise<boolean> {
  try {
    return (await leerCatalogo(clave)) !== null
  } catch {
    return false
  }
}

/**
 * Carga con respaldo: consulta al servidor y guarda; si falla —sin red— usa
 * lo guardado. Si no hay nada guardado, devuelve null.
 */
export async function cargarConRespaldo<T>(
  clave: string,
  consultar: () => Promise<T>,
): Promise<T | null> {
  try {
    const datos = await consultar()
    void guardarCatalogo(clave, datos).catch(() => {})
    return datos
  } catch {
    return leerCatalogo<T>(clave).catch(() => null)
  }
}
