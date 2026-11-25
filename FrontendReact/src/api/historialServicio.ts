import { cliente } from './cliente'

/** Un cambio del historial de capturas, ya con nombres legibles. */
export interface CambioHistorial {
  id: number
  accion: 'CREAR' | 'REEMPLAZAR'
  actor_login: string | null
  actor_usuario: string | null
  actor_capturista: number | null
  actor_dispositivo: number | null
  ip: string | null
  agente: string | null
  ocurrido_en: string

  id_casilla: number
  id_eleccion: number
  municipio: string
  seccion: string
  casilla: string

  antes_total: number | null
  antes_suma: number | null
  antes_nulos: number | null
  despues_total: number | null
  despues_suma: number | null
  despues_nulos: number | null
  votos_antes: number
}

export interface PaginaHistorial {
  resumen: { total: number; altas: number; reemplazos: number }
  filas: CambioHistorial[]
}

export interface FiltrosHistorial {
  idMunicipio?: number | null
  seccion?: string
  casilla?: string
  idEleccion?: number | null
  limite?: number
}

/**
 * Historial de capturas.
 *
 * La traza la escribe un trigger en la base; aquí solo se consulta. Los filtros
 * son opcionales y se mandan con el nombre que espera el servidor.
 */
export const historialServicio = {
  buscar: async (filtros: FiltrosHistorial): Promise<PaginaHistorial> =>
    (
      await cliente.get<PaginaHistorial>('/reportes/capturas/historial', {
        params: {
          id_municipio: filtros.idMunicipio ?? undefined,
          seccion: filtros.seccion || undefined,
          casilla: filtros.casilla || undefined,
          id_eleccion: filtros.idEleccion ?? undefined,
          limite: filtros.limite ?? 100,
        },
      })
    ).data,
}
