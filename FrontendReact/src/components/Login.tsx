import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Loader2 } from 'lucide-react'
import { useSesion } from '../context/SesionContext'
import { NOMBRE_SISTEMA, DESCRIPCION_SISTEMA } from '../utils/tema'

/**
 * Entrada al escritorio.
 *
 * Es la puerta de todo menos del móvil: catálogos, captura, capturistas y
 * reportes quedan detrás de esta pantalla.
 */
export function Login() {
  const { entrar, entrando, error, limpiarError } = useSesion()
  const navegar = useNavigate()

  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    try {
      await entrar(usuario, clave)
      navegar('/', { replace: true })
    } catch {
      // El mensaje ya quedó en el contexto; aquí solo se evita el error suelto.
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-fondo px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primario text-white">
            <KeyRound size={22} />
          </div>
          <h1 className="text-lg font-semibold text-texto">{NOMBRE_SISTEMA}</h1>
          <p className="mt-1 text-sm text-texto-tenue">{DESCRIPCION_SISTEMA}</p>
        </div>

        <form
          onSubmit={(e) => void enviar(e)}
          className="rounded-xl border border-borde bg-superficie p-6"
        >
          <label className="mb-4 block text-xs text-texto-tenue">
            Usuario
            <input
              value={usuario}
              onChange={(e) => {
                setUsuario(e.target.value)
                limpiarError()
              }}
              autoComplete="username"
              autoFocus
              className="mt-1 w-full rounded-lg border border-borde bg-superficie px-3 py-2.5 text-sm text-texto"
            />
          </label>

          <label className="mb-4 block text-xs text-texto-tenue">
            Contraseña
            <input
              type="password"
              value={clave}
              onChange={(e) => {
                setClave(e.target.value)
                limpiarError()
              }}
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-borde bg-superficie px-3 py-2.5 text-sm text-texto"
            />
          </label>

          {error && (
            <p className="mb-4 rounded-lg border border-red-300 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={entrando || !usuario || !clave}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primario px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {entrando && <Loader2 size={15} className="animate-spin" />}
            {entrando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-texto-tenue">
          El teléfono no usa esta pantalla: entra con su código de enrolamiento.
        </p>
      </div>
    </div>
  )
}
