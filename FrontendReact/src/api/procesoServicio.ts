import { cliente } from './cliente'
import type { Eleccion, Proceso } from '../types'

/** Procesos electorales y las elecciones que cuelgan de cada uno. */
export const procesoServicio = {
  listar: async (): Promise<Proceso[]> => (await cliente.get<Proceso[]>('/procesos')).data,

  elecciones: async (idProceso: number): Promise<Eleccion[]> =>
    (await cliente.get<Eleccion[]>(`/procesos/${idProceso}/elecciones`)).data,
}