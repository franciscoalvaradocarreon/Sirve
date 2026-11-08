import { cliente } from './cliente'
import type { Municipio } from '../types'

export const municipioServicio = {
  listar: async (idProceso: number): Promise<Municipio[]> =>
    (await cliente.get<Municipio[]>('/municipios', { params: { id_proceso: idProceso } })).data,
}