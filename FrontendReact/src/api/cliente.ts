import axios, { AxiosError } from 'axios'
import type { ErrorContrato } from '../types'
import { borrarSesion, leerPase } from '../utils/sesion'
import { leerToken } from '../utils/sesionEscritorio'

/**
 * Cliente HTTP único.
 *
 * En desarrollo, Vite reenvía /api al backend (ver vite.config.ts). En
 * producción el front va dentro del jar y comparte origen, así que la misma
 * base sirve en los dos entornos.
 *
 * El interceptor de petición pega el pase del teléfono, si lo hay. Va aquí y
 * no en cada pantalla para que ninguna llamada se quede sin él por descuido.
 *
 * El de respuesta convierte el error del contrato en un Error normal con
 * codigo y estado, para que las pantallas no tengan que conocer axios.
 */
export const cliente = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

/** Error de la API, ya interpretado. */
export class ErrorApi extends Error {
  codigo: string
  estado: number

  constructor(estado: number, codigo: string, mensaje: string) {
    super(mensaje)
    this.estado = estado
    this.codigo = codigo
  }
}

/*
 * Dos credenciales conviven en el mismo cliente.
 *
 * El teléfono manda su pase; el escritorio, el token de su sesión. Se elige
 * el pase primero porque las rutas del móvil solo entienden ese, y porque un
 * navegador de escritorio nunca lo tiene guardado.
 */
/*
 * Rutas que solo entienden el pase del teléfono.
 *
 * Ahí NO se manda el token del escritorio, aunque lo haya: el navegador de la
 * misma máquina puede tener las dos cosas —la sesión web y la app del
 * teléfono—, y colar el token en una ruta del móvil hacía que el servidor la
 * rechazara y, peor, que se cerrara la sesión del escritorio.
 */
/**
 * Rutas que SOLO entienden el pase del teléfono.
 *
 * En ellas nunca se manda el token de escritorio: el navegador de la misma
 * máquina puede tener las dos credenciales, y colar el token ahí hacía que el
 * servidor rechazara la petición y cerrara la sesión web.
 *
 * Ojo: son las que no deben llevar token, no las únicas que llevan pase. Los
 * catálogos —/procesos, /elecciones— los usa el teléfono con su pase y el
 * escritorio con su token, así que se manda el que haya.
 */
const RUTAS_SOLO_MOVIL = [
  '/capturas',
  '/mis-casillas',
  '/sesion',
  '/actas',
  '/dispositivos',
]

const esRutaSoloMovil = (url: string | undefined) =>
  !!url && RUTAS_SOLO_MOVIL.some((r) => url === r || url.startsWith(r + '/') || url.startsWith(r + '?'))

cliente.interceptors.request.use((configuracion) => {
  // El pase manda cuando existe: si este navegador es el teléfono, todas sus
  // peticiones van con él, incluidos los catálogos.
  const pase = leerPase()
  if (pase) {
    configuracion.headers.Authorization = `Bearer ${pase}`
    return configuracion
  }

  // Sin pase, se usa la sesión del escritorio, salvo en las rutas que solo
  // entienden el pase.
  if (!esRutaSoloMovil(configuracion.url)) {
    const token = leerToken()
    if (token) configuracion.headers.Authorization = `Bearer ${token}`
  }
  return configuracion
})

/** Aviso de que la sesión del escritorio dejó de servir. */
export const EVENTO_SESION_ESCRITORIO = 'sirve:sesion-escritorio-vencida'

/**
 * Aviso de que el pase dejó de servir.
 *
 * La pantalla lo escucha y vuelve al enrolamiento. Se usa un evento y no una
 * redirección directa para no meter el enrutador dentro del cliente HTTP.
 */
export const EVENTO_SESION_EXPIRADA = 'sirve:sesion-expirada'

cliente.interceptors.response.use(
  (respuesta) => respuesta,
  (error: AxiosError<{ error?: ErrorContrato }>) => {
    const estado = error.response?.status ?? 0
    const cuerpo = error.response?.data?.error

    /*
     * 401 significa que el pase ya no vale: el teléfono se dio de baja, se
     * reemitió el código o alguien desactivó el aparato. Sin esto la
     * aplicación seguía mostrando la captura con datos guardados y los envíos
     * fallaban en silencio.
     */
    /*
     * Un 401 se interpreta según la ruta que falló, no según lo que haya
     * guardado: si falló una ruta del teléfono, se cierra la sesión del
     * teléfono; si falló una del escritorio, la del escritorio. Antes se
     * miraba el pase guardado, y un fallo del móvil cerraba la sesión web.
     */
    if (estado === 401 && cuerpo?.codigo === 'NO_AUTENTICADO') {
      if (esRutaSoloMovil(error.config?.url)) {
        borrarSesion()
        window.dispatchEvent(new Event(EVENTO_SESION_EXPIRADA))
      } else {
        window.dispatchEvent(new Event(EVENTO_SESION_ESCRITORIO))
      }
    }

    return Promise.reject(
      new ErrorApi(
        estado,
        cuerpo?.codigo ?? 'SIN_CONEXION',
        cuerpo?.mensaje ?? 'No se pudo conectar con el servidor',
      ),
    )
  },
)
