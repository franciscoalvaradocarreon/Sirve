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
 * acota la consulta. La pantalla de catálogo pide todas y filtra en el
 * navegador, pero la de captura pedirá una sección concreta.
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
}