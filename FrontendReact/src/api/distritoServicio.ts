import { cliente } from './cliente'
import type { Distrito } from '../types'

/** Distritos electorales. El tipo es LOCAL o FEDERAL. */
export const distritoServicio = {
  listar: async (tipo: 'LOCAL' | 'FEDERAL', idProceso: number): Promise<Distrito[]> =>
    (await cliente.get<Distrito[]>('/distritos', { params: { tipo, id_proceso: idProceso } }))
      .data,
}