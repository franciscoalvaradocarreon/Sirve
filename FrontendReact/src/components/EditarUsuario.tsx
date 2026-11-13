import { useState } from 'react'
import { Pencil, X } from 'lucide-react'
import { usuarioServicio } from '../api/usuarioServicio'
import type { UsuarioSesion } from '../types'

/**
 * Edición de un usuario: nombre y rol.
 *
 * El nombre de usuario no se edita: es su identidad en el sistema y cambiarlo
 * rompería lo que ya esté acostumbrado a escribir. Si hace falta otro, se crea
 * uno nuevo y se desactiva el anterior.
 *
 * El estado —activo o inactivo— se cambia desde la tabla, con un clic.
 */
export function EditarUsuario({
  usuario,
  alCerrar,
  alTerminar,
}: {
  usuario: UsuarioSesion
  alCerrar: () => void
  alTerminar: () => void
}) {
  const [nombre, setNombre] = useState(usuario.nombre)
  const [rol, setRol] = useState(usuario.rol)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const roles = [
    ['ADMIN', 'Administrador'],
    ['COORDINADOR', 'Supervisor'],
    ['OPERADOR', 'Capturista'],
    ['ANALISTA', 'Analista'],
    ['AUDITOR', 'Auditor'],
  ]

  const campo = 'mt-1 w-full rounded-lg border border-borde bg-superficie px-3 py-2 text-sm text-texto'

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      await usuarioServicio.actualizar(usuario.id, {
        nombre: nombre.trim(),
        rol,
        activo: usuario.activo,
      })
      alTerminar()
      alCerrar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
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
              <Pencil size={15} />
              Editar usuario
            </h2>
            <p className="mt-1 font-mono text-xs text-texto-tenue">{usuario.usuario}</p>
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

        <label className="mb-3 block text-xs text-texto-tenue">
          Nombre completo
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoFocus
            className={campo}
          />
        </label>

        <label className="mb-3 block text-xs text-texto-tenue">
          Rol
          <select value={rol} onChange={(e) => setRol(e.target.value)} className={campo}>
            {roles.map(([clave, etiqueta]) => (
              <option key={clave} value={clave}>
                {etiqueta}
              </option>
            ))}
          </select>
        </label>

        <p className="mb-3 text-xs text-texto-tenue">
          El nombre de usuario no se cambia: es su identidad en el sistema.
        </p>

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
            disabled={guardando || !nombre.trim()}
            className="rounded-lg bg-primario px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}
