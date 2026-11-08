import { cliente } from './cliente'
import type { Seccion } from '../types'

/**
 * Secciones de un proceso.
 *
 * Sin municipio devuelve todas las del proceso: es lo que usa la pantalla
 * cuando el filtro de municipio está en «Todos».
 */
export const seccionServicio = {
  listar: async (idMunicipio: number | null, idProceso: number): Promise<Seccion[]> =>
    (
      await cliente.get<Seccion[]>('/secciones', {
        params: idMunicipio
          ? { id_municipio: idMunicipio, id_proceso: idProceso }
          : { id_proceso: idProceso },
      })
    ).data,
}