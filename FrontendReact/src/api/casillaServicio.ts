import { cliente } from './cliente'
import type { Casilla } from '../types'

export interface FiltrosCasilla {
  idMunicipio?: number | null
  seccion?: string | null
  distritoLocal?: string | null
  distritoFederal?: string | null
}

/**
 * Casillas de una elección.
 *
 * Sin filtros devuelve todas las de la elección; con ellos, el servidor
 * acota la consulta.
 */
export const casillaServicio = {
  listar: async (idEleccion: number, filtros: FiltrosCasilla = {}): Promise<Casilla[]> =>
    (
      await cliente.get<Casilla[]>('/casillas', {
        params: {
          id_eleccion: idEleccion,
          ...(filtros.idMunicipio ? { id_municipio: filtros.idMunicipio } : {}),
          ...(filtros.seccion ? { seccion: filtros.seccion } : {}),
          ...(filtros.distritoLocal ? { distrito_local: filtros.distritoLocal } : {}),
          ...(filtros.distritoFederal ? { distrito_federal: filtros.distritoFederal } : {}),
        },
      })
    ).data,

  /**
   * Todas las casillas de una elección, con un tiempo de espera largo.
   *
   * Es el listado completo —unos 2 MB— y en datos móviles puede tardar. Con el
   * tiempo de espera normal de quince segundos se cortaba a media descarga y la
   * preparación para trabajar sin conexión fallaba sin decir por qué.
   */
  listarTodas: async (idEleccion: number): Promise<Casilla[]> =>
    (
      await cliente.get<Casilla[]>('/casillas', {
        params: { id_eleccion: idEleccion },
        timeout: 60000,
      })
    ).data,
}
