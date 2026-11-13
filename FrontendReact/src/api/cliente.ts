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
 * Aquí conviven dos credenciales: el pase del teléfono y el token del
 * escritorio. El interceptor decide cuál mandar y el de respuesta interpreta
 * los 401 según la pantalla —no según la ruta— para que un fallo del teléfono
 * no cierre la sesión del escritorio.
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

/**
 * ¿Estamos en la pantalla del teléfono?
 *
 * Es la pregunta que decide qué credencial se manda.
 *
 * En el mismo navegador pueden convivir las dos: alguien abre /movil para
 * probar y luego entra al escritorio, y quedan guardados el pase del teléfono
 * y el token de la sesión. Antes se elegía por la ruta del API, y eso fallaba:
 * con un pase guardado, las peticiones del escritorio salían con el pase, el
 * servidor las rechazaba y la sesión se cerraba sola al instante.
 *
 * Se mira la pantalla, no la ruta: en /movil manda el pase; en el resto, el
 * token.
 */
const enPantallaDelMovil = () =>
  typeof window !== 'undefined' && window.location.pathname.startsWith('/movil')

cliente.interceptors.request.use((configuracion) => {
  if (enPantallaDelMovil()) {
    const pase = leerPase()
    if (pase) configuracion.headers.Authorization = `Bearer ${pase}`
    return configuracion
  }

  const token = leerToken()
  if (token) configuracion.headers.Authorization = `Bearer ${token}`
  return configuracion
})

/** Aviso de que la sesión del escritorio dejó de servir. */
export const EVENTO_SESION_ESCRITORIO = 'sirve:sesion-escritorio-vencida'

/**
 * Aviso de que el pase del teléfono dejó de servir.
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
     * Un 401 significa que la credencial dejó de valer. Qué sesión se cierra
     * depende de la pantalla en la que esté el usuario: en el teléfono, la del
     * teléfono —el aparato se dio de baja o se reemitió el código—; en el
     * escritorio, la del escritorio.
     */
    if (estado === 401 && cuerpo?.codigo === 'NO_AUTENTICADO') {
      if (enPantallaDelMovil()) {
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
