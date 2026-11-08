import { cliente } from './cliente'
import type { AgrupacionAvance, AvanceResumen } from '../types'

/** Reporte de avance de la captura. */
export const avanceServicio = {
  resumir: async (
    idEleccion: number,
    agrupacion: AgrupacionAvance,
  ): Promise<AvanceResumen> =>
    (
      await cliente.get<AvanceResumen>('/avance', {
        params: { id_eleccion: idEleccion, agrupacion },
      })
    ).data,
}
