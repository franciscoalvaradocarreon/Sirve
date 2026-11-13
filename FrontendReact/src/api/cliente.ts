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
const RUTAS_DEL_MOVIL = [
  '/capturas',
  '/mis-casillas',
  '/sesion',
  '/actas',
  '/dispositivos',
]

const esRutaDelMovil = (url: string | undefined) =>
  !!url && RUTAS_DEL_MOVIL.some((r) => url === r || url.startsWith(r + '/') || url.startsWith(r + '?'))

cliente.interceptors.request.use((configuracion) => {
  if (esRutaDelMovil(configuracion.url)) {
    const pase = leerPase()
    if (pase) configuracion.headers.Authorization = `Bearer ${pase}`
    return configuracion
  }

  const token = leerToken()
  if (token) {
    configuracion.headers.Authorization = `Bearer ${token}`
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
      if (esRutaDelMovil(error.config?.url)) {
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
