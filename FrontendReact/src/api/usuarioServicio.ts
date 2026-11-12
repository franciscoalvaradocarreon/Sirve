import { cliente } from './cliente'
import type { UsuarioSesion } from '../types'

/** Administración de usuarios del escritorio. */
export const usuarioServicio = {
  listar: async (): Promise<UsuarioSesion[]> =>
    (await cliente.get<UsuarioSesion[]>('/usuarios')).data,

  /** Devuelve la contraseña generada, que se muestra una sola vez. */
  crear: async (datos: {
    usuario: string
    nombre: string
    rol: string
    clave?: string
  }): Promise<string> =>
    (await cliente.post<{ clave: string }>('/usuarios', datos)).data.clave,

  actualizar: async (
    id: string,
    datos: { nombre: string; rol: string; activo: boolean },
  ): Promise<void> => {
    await cliente.put(`/usuarios/${id}`, datos)
  },

  restablecer: async (id: string): Promise<string> =>
    (await cliente.post<{ clave: string }>(`/usuarios/${id}/clave`, {})).data.clave,

  eliminar: async (id: string): Promise<void> => {
    await cliente.delete(`/usuarios/${id}`)
  },

  cambiarPropia: async (actual: string, nueva: string): Promise<void> => {
    await cliente.post('/usuarios/mia', { actual, nueva })
  },
}