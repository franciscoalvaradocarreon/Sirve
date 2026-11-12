import { cliente } from './cliente'
import type { MenuServidor, RespuestaLogin } from '../types'

/** Entrada y salida del escritorio. */
export const authServicio = {
  entrar: async (usuario: string, clave: string): Promise<RespuestaLogin> =>
    (await cliente.post<RespuestaLogin>('/auth/login', { usuario, clave })).data,

  salir: async (): Promise<void> => {
    await cliente.post('/auth/salir')
  },

  menu: async (): Promise<MenuServidor[]> =>
    (await cliente.get<MenuServidor[]>('/menu')).data,
}