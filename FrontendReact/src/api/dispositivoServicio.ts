import { cliente } from './cliente'
import type { CasillaAsignada, Enrolamiento } from '../types'

/** Enrolamiento del teléfono y sus casillas asignadas. */
export const dispositivoServicio = {
  /**
   * Canjea el código de la hoja por un pase.
   *
   * La elección es opcional; si se manda, la respuesta trae además las
   * casillas asignadas, para no pedirlas en una segunda llamada.
   */
  enrolar: async (codigo: string, idEleccion?: number | null): Promise<Enrolamiento> =>
    (
      await cliente.post<Enrolamiento>(
        '/dispositivos/enrolar',
        { codigo },
        { params: idEleccion ? { id_eleccion: idEleccion } : {} },
      )
    ).data,

  /** Las casillas de este teléfono en una elección. */
  misCasillas: async (idEleccion: number): Promise<CasillaAsignada[]> =>
    (
      await cliente.get<CasillaAsignada[]>('/mis-casillas', {
        params: { id_eleccion: idEleccion },
      })
    ).data,
}
