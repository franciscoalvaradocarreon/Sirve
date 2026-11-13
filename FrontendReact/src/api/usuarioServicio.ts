import { cliente } from './cliente'
import type { UsuarioSesion } from '../types'

/** Administración de usuarios del escritorio. */
export const usuarioServicio = {
  listar: async (): Promise<UsuarioSesion[]> =>
    (await cliente.get<UsuarioSesion[]>('/usuarios')).data,

  crear: async (datos: {
    usuario: string
    nombre: string
    rol: string
    clave: string
  }): Promise<void> => {
    await cliente.post('/usuarios', datos)
  },

  actualizar: async (
    id: string,
    datos: { usuario: string; nombre: string; rol: string; activo: boolean },
  ): Promise<void> => {
    await cliente.put(`/usuarios/${id}`, datos)
  },

  /** La contraseña la escribe quien administra; no se genera ni se devuelve. */
  restablecer: async (id: string, clave: string): Promise<void> => {
    await cliente.post(`/usuarios/${id}/clave`, { clave })
  },

  eliminar: async (id: string): Promise<void> => {
    await cliente.delete(`/usuarios/${id}`)
  },

  cambiarPropia: async (actual: string, nueva: string): Promise<void> => {
    await cliente.post('/usuarios/mia', { actual, nueva })
  },
}