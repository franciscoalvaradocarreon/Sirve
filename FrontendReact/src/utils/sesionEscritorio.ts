import type { MenuServidor, UsuarioSesion } from '../types'

/**
 * Sesión del escritorio: el token, quién entró y qué menús le tocan.
 *
 * Va en localStorage y no en una cookie porque el API viaja con la cabecera
 * Authorization, igual que el pase del móvil. El arranque del móvil es otro:
 * vive en `utils/sesion.ts` y no se tocan entre sí.
 */

const CLAVE_TOKEN = 'sirve:token'
const CLAVE_USUARIO = 'sirve:usuario'
const CLAVE_MENUS = 'sirve:menus'

export function guardarSesionEscritorio(
  token: string,
  usuario: UsuarioSesion,
  menus: MenuServidor[],
) {
  localStorage.setItem(CLAVE_TOKEN, token)
  localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario))
  localStorage.setItem(CLAVE_MENUS, JSON.stringify(menus))
}

export const leerToken = (): string | null => localStorage.getItem(CLAVE_TOKEN)

export function leerUsuario(): UsuarioSesion | null {
  try {
    const crudo = localStorage.getItem(CLAVE_USUARIO)
    return crudo ? (JSON.parse(crudo) as UsuarioSesion) : null
  } catch {
    return null
  }
}

export function leerMenus(): MenuServidor[] {
  try {
    const crudo = localStorage.getItem(CLAVE_MENUS)
    return crudo ? (JSON.parse(crudo) as MenuServidor[]) : []
  } catch {
    return []
  }
}

export function guardarMenus(menus: MenuServidor[]) {
  localStorage.setItem(CLAVE_MENUS, JSON.stringify(menus))
}

export function borrarSesionEscritorio() {
  localStorage.removeItem(CLAVE_TOKEN)
  localStorage.removeItem(CLAVE_USUARIO)
  localStorage.removeItem(CLAVE_MENUS)
}

/** ¿El token ya venció? Se mira la fecha que lleva dentro, sin verificar firma. */
export function tokenVencido(token: string): boolean {
  try {
    const cuerpo = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof cuerpo.exp === 'number' && cuerpo.exp * 1000 < Date.now()
  } catch {
    return true
  }
}
