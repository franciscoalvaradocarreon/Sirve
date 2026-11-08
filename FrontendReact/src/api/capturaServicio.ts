import { cliente } from './cliente'
import type { Captura, CapturaCrear, Voto } from '../types'

/** Captura y consulta de resultados por casilla. */
export const capturaServicio = {
  consultar: async (idCasilla: number, idEleccion: number): Promise<Captura> =>
    (await cliente.get<Captura>(`/capturas/${idCasilla}/${idEleccion}`)).data,

  votos: async (idCasilla: number, idEleccion: number): Promise<Voto[]> =>
    (await cliente.get<Voto[]>(`/capturas/${idCasilla}/${idEleccion}/votos`)).data,

  guardar: async (datos: CapturaCrear): Promise<Captura> =>
    (await cliente.post<Captura>('/capturas', datos)).data,
}