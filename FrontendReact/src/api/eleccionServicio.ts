import { cliente } from './cliente'
import type { OpcionBoleta } from '../types'

/** La boleta de una elección. */
export const eleccionServicio = {
  opciones: async (idEleccion: number): Promise<OpcionBoleta[]> =>
    (await cliente.get<OpcionBoleta[]>(`/elecciones/${idEleccion}/opciones`)).data,
}