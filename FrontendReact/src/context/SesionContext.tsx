import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { authServicio } from '../api/authServicio'
import { EVENTO_SESION_ESCRITORIO } from '../api/cliente'
import {
  borrarSesionEscritorio,
  guardarMenus,
  guardarSesionEscritorio,
  leerMenus,
  leerToken,
  leerUsuario,
  tokenVencido,
} from '../utils/sesionEscritorio'
import type { MenuServidor, UsuarioSesion } from '../types'

/**
 * Quién está dentro del escritorio.
 *
 * El token y el menú se guardan en localStorage para no pedir la contraseña en
 * cada recarga. El menú se refresca al arrancar: si un administrador cambió
 * los permisos del rol, el usuario lo ve al recargar sin volver a entrar.
 */
interface Contexto {
  usuario: UsuarioSesion | null
  menus: MenuServidor[]
  entrando: boolean
  error: string | null
  entrar: (usuario: string, clave: string) => Promise<void>
  salir: () => Promise<void>
  limpiarError: () => void
}

const SesionContext = createContext<Contexto | undefined>(undefined)

export function SesionProveedor({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(() => {
    const guardado = leerToken()
    if (!guardado || tokenVencido(guardado)) return null
    return leerUsuario()
  })
  const [menus, setMenus] = useState<MenuServidor[]>(() => leerMenus())
  const [entrando, setEntrando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const olvidar = useCallback(() => {
    borrarSesionEscritorio()
    setUsuario(null)
    setMenus([])
  }, [])

  // El cliente HTTP avisa cuando el servidor rechaza el token: sesión vencida,
  // usuario desactivado o contraseña cambiada desde otro equipo.
  useEffect(() => {
    const alExpirar = () => olvidar()
    window.addEventListener(EVENTO_SESION_ESCRITORIO, alExpirar)
    return () => window.removeEventListener(EVENTO_SESION_ESCRITORIO, alExpirar)
  }, [olvidar])

  // Al arrancar se refresca el menú, por si cambiaron los permisos del rol.
  useEffect(() => {
    if (!usuario) return
    authServicio
      .menu()
      .then((datos) => {
        setMenus(datos)
        guardarMenus(datos)
      })
      .catch(() => {
        // Sin red se queda el menú guardado; el API rechazará lo que no toque.
      })
  }, [usuario])

  const entrar = useCallback(async (nombreUsuario: string, clave: string) => {
    setEntrando(true)
    setError(null)
    try {
      const respuesta = await authServicio.entrar(nombreUsuario, clave)
      guardarSesionEscritorio(respuesta.token, respuesta.usuario, respuesta.menus)
      setUsuario(respuesta.usuario)
      setMenus(respuesta.menus)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo entrar')
      throw e
    } finally {
      setEntrando(false)
    }
  }, [])

  const salir = useCallback(async () => {
    // Se avisa al servidor antes de borrar nada: eso invalida el token de
    // verdad. Si la llamada falla, la sesión local se cierra igual.
    await authServicio.salir().catch(() => undefined)
    olvidar()
  }, [olvidar])

  return (
    <SesionContext.Provider
      value={{
        usuario,
        menus,
        entrando,
        error,
        entrar,
        salir,
        limpiarError: () => setError(null),
      }}
    >
      {children}
    </SesionContext.Provider>
  )
}

export function useSesion() {
  const contexto = useContext(SesionContext)
  if (!contexto) throw new Error('useSesion debe usarse dentro de SesionProveedor')
  return contexto
}
