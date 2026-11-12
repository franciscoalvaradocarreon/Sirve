import { useState } from 'react'
import { KeyRound, X } from 'lucide-react'
import { usuarioServicio } from '../api/usuarioServicio'

/**
 * Ventana para cambiar una contraseña.
 *
 * Sirve para dos casos: la propia —pidiendo la actual— y la de otro usuario,
 * cuando la restablece un administrador. En el segundo no se pide la anterior:
 * quien administra puede asignarla sin conocerla.
 *
 * La contraseña la escribe una persona, no se genera: así la sabe desde el
 * principio y no depende de copiarla de un aviso que se cierra.
 */
export function CambiarClave({
  titulo,
  nombre,
  propia,
  idUsuario,
  alCerrar,
  alTerminar,
}: {
  titulo: string
  nombre?: string
  propia: boolean
  idUsuario?: string
  alCerrar: () => void
  alTerminar?: () => void
}) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const campo = 'mt-1 w-full rounded-lg border border-borde bg-superficie px-3 py-2 text-sm text-texto'

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (nueva !== repetir) {
      setError('Las dos contraseñas no coinciden.')
      return
    }
    if (nueva.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    setGuardando(true)
    try {
      if (propia) await usuarioServicio.cambiarPropia(actual, nueva)
      else if (idUsuario) await usuarioServicio.restablecer(idUsuario, nueva)
      alTerminar?.()
      alCerrar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={alCerrar}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => void guardar(e)}
        className="w-full max-w-sm rounded-xl border border-borde bg-superficie p-5"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-texto">
              <KeyRound size={16} />
              {titulo}
            </h2>
            {nombre && <p className="mt-1 text-xs text-texto-tenue">{nombre}</p>}
          </div>
          <button
            type="button"
            onClick={alCerrar}
            className="rounded p-1 text-texto-tenue hover:text-texto"
            title="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {propia && (
          <label className="mb-3 block text-xs text-texto-tenue">
            Contraseña actual
            <input
              type="password"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              autoComplete="current-password"
              autoFocus
              className={campo}
            />
          </label>
        )}

        <label className="mb-3 block text-xs text-texto-tenue">
          Contraseña nueva
          <input
            type="password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            autoComplete="new-password"
            autoFocus={!propia}
            className={campo}
          />
        </label>

        <label className="mb-3 block text-xs text-texto-tenue">
          Repite la contraseña
          <input
            type="password"
            value={repetir}
            onChange={(e) => setRepetir(e.target.value)}
            autoComplete="new-password"
            className={campo}
          />
        </label>

        {error && (
          <p className="mb-3 rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={alCerrar}
            className="rounded-lg border border-borde px-4 py-2 text-sm text-texto-tenue"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando || !nueva || !repetir || (propia && !actual)}
            className="rounded-lg bg-primario px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Cambiar'}
          </button>
        </div>
      </form>
    </div>
  )
}
