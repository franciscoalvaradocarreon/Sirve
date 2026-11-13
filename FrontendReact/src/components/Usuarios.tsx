import { useEffect, useState } from 'react'
import { KeyRound, Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { CambiarClave } from './CambiarClave'
import { EditarUsuario } from './EditarUsuario'
import { usuarioServicio } from '../api/usuarioServicio'
import { useSesion } from '../context/SesionContext'
import type { UsuarioSesion } from '../types'

/**
 * Administración de usuarios del escritorio.
 *
 * Solo la abre un ADMIN: el menú no se la muestra a los demás y el API la
 * rechaza igual. Las dos cosas, porque ocultar un enlace no es protegerlo.
 *
 * La contraseña se muestra una sola vez, al crearla o al restablecerla. No se
 * guarda en claro en ninguna parte, así que no hay forma de consultarla
 * después: si se pierde, se restablece.
 */
export function Usuarios() {
  const { usuario: yo } = useSesion()

  const [lista, setLista] = useState<UsuarioSesion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** Usuario al que se le está asignando una contraseña nueva. */
  const [cambiando, setCambiando] = useState<UsuarioSesion | null>(null)
  const [editando, setEditando] = useState<UsuarioSesion | null>(null)

  const [creando, setCreando] = useState(false)
  const [nuevoUsuario, setNuevoUsuario] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoRol, setNuevoRol] = useState('OPERADOR')
  const [nuevaClave, setNuevaClave] = useState('')

  const roles = [
    ['ADMIN', 'Administrador — todo, incluidos usuarios'],
    ['COORDINADOR', 'Supervisor — todo menos usuarios'],
    ['OPERADOR', 'Capturista — captura y consulta'],
    ['ANALISTA', 'Analista — solo reportes'],
    ['AUDITOR', 'Auditor — solo reportes'],
  ]

  function recargar() {
    setCargando(true)
    usuarioServicio
      .listar()
      .then(setLista)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }

  useEffect(recargar, [])

  async function crear() {
    try {
      await usuarioServicio.crear({
        usuario: nuevoUsuario,
        nombre: nuevoNombre,
        rol: nuevoRol,
        clave: nuevaClave,
      })
      setCreando(false)
      setNuevoUsuario('')
      setNuevoNombre('')
      setNuevaClave('')
      recargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear')
    }
  }



  async function cambiarEstado(u: UsuarioSesion) {
    try {
      await usuarioServicio.actualizar(u.id, {
        nombre: u.nombre,
        rol: u.rol,
        activo: !u.activo,
      })
      recargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar')
    }
  }

  async function eliminar(u: UsuarioSesion) {
    if (!window.confirm(`¿Eliminar a ${u.nombre}? Sus capturas se conservan.`)) return
    try {
      await usuarioServicio.eliminar(u.id)
      recargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar')
    }
  }

  const campo = 'w-full rounded-lg border border-borde bg-superficie px-3 py-2 text-sm text-texto'

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-texto">Usuarios</h1>
          <p className="mt-1 text-sm text-texto-tenue">
            Quién entra al escritorio y qué puede ver. El teléfono no usa esto.
          </p>
        </div>
        <button
          onClick={() => setCreando((v) => !v)}
          className="flex items-center gap-2 rounded-lg bg-primario px-3 py-2 text-sm font-medium text-white"
        >
          <Plus size={16} />
          Nuevo usuario
        </button>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {creando && (
        <div className="mb-4 rounded-xl border border-borde bg-superficie p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs text-texto-tenue">
              Usuario
              <input
                value={nuevoUsuario}
                onChange={(e) => setNuevoUsuario(e.target.value)}
                placeholder="juan.perez"
                className={`mt-1 ${campo}`}
              />
            </label>
            <label className="block text-xs text-texto-tenue">
              Nombre completo
              <input
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Juan Pérez"
                className={`mt-1 ${campo}`}
              />
            </label>
            <label className="block text-xs text-texto-tenue">
              Rol
              <select
                value={nuevoRol}
                onChange={(e) => setNuevoRol(e.target.value)}
                className={`mt-1 ${campo}`}
              >
                {roles.map(([clave, texto]) => (
                  <option key={clave} value={clave}>
                    {texto}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-3 block text-xs text-texto-tenue">
            Contraseña
            <input
              type="password"
              value={nuevaClave}
              onChange={(e) => setNuevaClave(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              className={`mt-1 max-w-xs ${campo}`}
            />
          </label>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => void crear()}
              disabled={!nuevoUsuario || !nuevoNombre || nuevaClave.length < 8}
              className="rounded-lg bg-primario px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Crear y generar contraseña
            </button>
            <button
              onClick={() => setCreando(false)}
              className="rounded-lg border border-borde px-4 py-2 text-sm text-texto-tenue"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-tenue">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-texto-tenue">
                  Cargando…
                </td>
              </tr>
            )}

            {!cargando && lista.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-texto-tenue">
                  <UserRound size={20} className="mx-auto mb-2 opacity-40" />
                  No hay usuarios.
                </td>
              </tr>
            )}

            {lista.map((u) => (
              <tr key={u.id} className="border-b border-borde last:border-0">
                <td className="px-4 py-3 text-texto">
                  {u.nombre}
                  {u.id === yo?.id && (
                    <span className="ml-2 rounded-full bg-fondo-alt px-2 py-0.5 text-xs text-texto-tenue">
                      tú
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-texto-tenue">{u.usuario}</td>
                <td className="px-4 py-3 text-texto-tenue">{u.rol_nombre}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => void cambiarEstado(u)}
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      u.activo
                        ? 'bg-primario/10 text-primario'
                        : 'bg-fondo-alt text-texto-tenue'
                    }`}
                  >
                    {u.activo ? 'activo' : 'inactivo'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setEditando(u)}
                    className="rounded p-1.5 text-texto-tenue hover:text-primario"
                    title="Editar nombre y rol"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setCambiando(u)}
                    className="rounded p-1.5 text-texto-tenue hover:text-primario"
                    title="Cambiar contraseña"
                  >
                    <KeyRound size={15} />
                  </button>
                  <button
                    onClick={() => void eliminar(u)}
                    className="rounded p-1.5 text-texto-tenue hover:text-red-600"
                    title="Eliminar"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editando && (
        <EditarUsuario
          usuario={editando}
          alCerrar={() => setEditando(null)}
          alTerminar={recargar}
        />
      )}

      {cambiando && (
        <CambiarClave
          titulo="Cambiar contraseña"
          nombre={`${cambiando.nombre} · ${cambiando.usuario}`}
          propia={false}
          idUsuario={cambiando.id}
          alCerrar={() => setCambiando(null)}
          alTerminar={() => setError(null)}
        />
      )}
    </div>
  )
}
