import axios, { AxiosError } from 'axios'
import type { ErrorContrato } from '../types'

/**
 * Cliente HTTP único.
 *
 * En desarrollo, Vite reenvía /api al backend (ver vite.config.ts). En
 * producción el front va dentro del WAR y comparte origen, así que la misma
 * base sirve en los dos entornos.
 *
 * El interceptor convierte el error del contrato en un Error normal con
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

cliente.interceptors.response.use(
  (respuesta) => respuesta,
  (error: AxiosError<{ error?: ErrorContrato }>) => {
    const estado = error.response?.status ?? 0
    const cuerpo = error.response?.data?.error
    return Promise.reject(
      new ErrorApi(
        estado,
        cuerpo?.codigo ?? 'SIN_CONEXION',
        cuerpo?.mensaje ?? 'No se pudo conectar con el servidor',
      ),
    )
  },
)