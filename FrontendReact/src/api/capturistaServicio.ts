import { cliente } from './cliente'
import type { Capturista, CodigoEnrolamiento, Telefono } from '../types'

/** Alta, edición y asignación de capturistas. Solo desde escritorio. */
export const capturistaServicio = {
  listar: async (): Promise<Capturista[]> =>
    (await cliente.get<Capturista[]>('/capturistas')).data,

  obtener: async (id: number): Promise<Capturista> =>
    (await cliente.get<Capturista>(`/capturistas/${id}`)).data,

  crear: async (datos: {
    nombre: string
    telefono: string | null
    activo: boolean
    casillas: number[]
  }): Promise<Capturista> => (await cliente.post<Capturista>('/capturistas', datos)).data,

  actualizar: async (
    id: number,
    datos: { nombre: string; telefono: string | null; activo: boolean; casillas: number[] },
  ): Promise<Capturista> => (await cliente.put<Capturista>(`/capturistas/${id}`, datos)).data,

  eliminar: async (id: number): Promise<void> => {
    await cliente.delete(`/capturistas/${id}`)
  },

  asignar: async (id: number, casillas: number[]): Promise<Capturista> =>
    (await cliente.put<Capturista>(`/capturistas/${id}/casillas`, { casillas })).data,

  telefonos: async (id: number): Promise<Telefono[]> =>
    (await cliente.get<Telefono[]>(`/capturistas/${id}/telefonos`)).data,

  nuevoTelefono: async (id: number, nombre?: string): Promise<CodigoEnrolamiento> =>
    (
      await cliente.post<CodigoEnrolamiento>(`/capturistas/${id}/telefonos`, null, {
        params: nombre ? { nombre } : {},
      })
    ).data,

  reemitirCodigo: async (idDispositivo: number): Promise<CodigoEnrolamiento> =>
    (
      await cliente.post<CodigoEnrolamiento>(
        `/capturistas/telefonos/${idDispositivo}/codigo`,
        null,
      )
    ).data,

  desactivarTelefono: async (idDispositivo: number): Promise<void> => {
    await cliente.delete(`/capturistas/telefonos/${idDispositivo}`)
  },
}
