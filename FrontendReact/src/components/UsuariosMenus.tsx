import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Save } from 'lucide-react'
import { cliente } from '../api/cliente'

interface Menu {
  id: number
  clave: string
  etiqueta: string
  ruta: string | null
  id_padre: number | null
  orden: number
}

interface Rol {
  clave: string
  nombre: string
}

interface Estado {
  menus: Menu[]
  roles: Rol[]
  permisos: Record<string, number[]>
}

/**
 * Qué menús ve cada rol.
 *
 * Es una matriz: los menús en las filas, los roles en las columnas. Marcar una
 * casilla concede ese menú a ese rol, y aplica a todos los usuarios de ese rol
 * la próxima vez que recarguen.
 *
 * Los grupos —Catálogos, Reportes— necesitan estar marcados para que sus hijos
 * aparezcan: si falta el padre, el menú del servidor sube los hijos a la raíz,
 * lo que suele verse raro. Por eso al marcar un hijo se marca su grupo.
 */
export function UsuariosMenus() {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [permisos, setPermisos] = useState<Record<string, Set<number>>>({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [guardado, setGuardado] = useState<string | null>(null)

  useEffect(() => {
    cliente
      .get<Estado>('/usuarios/menus')
      .then((r) => {
        setEstado(r.data)
        const mapa: Record<string, Set<number>> = {}
        for (const rol of r.data.roles) {
          mapa[rol.clave] = new Set(r.data.permisos[rol.clave] ?? [])
        }
        setPermisos(mapa)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar'))
      .finally(() => setCargando(false))
  }, [])

  function alternar(claveRol: string, menu: Menu, marcar: boolean) {
    setPermisos((prev) => {
      const siguiente = { ...prev, [claveRol]: new Set(prev[claveRol]) }
      const set = siguiente[claveRol]

      if (marcar) {
        set.add(menu.id)
        // El grupo también, para que el hijo no quede suelto en la raíz.
        if (menu.id_padre) set.add(menu.id_padre)
      } else {
        set.delete(menu.id)
        // Al quitar un grupo se quitan sus hijos: dejarlos con el padre
        // apagado los mostraría sueltos, que es peor que no verlos.
        estado?.menus
          .filter((m) => m.id_padre === menu.id)
          .forEach((hijo) => set.delete(hijo.id))
      }
      return siguiente
    })
    setGuardado(null)
  }

  async function guardar(claveRol: string) {
    setGuardando(claveRol)
    setError(null)
    try {
      await cliente.put(`/usuarios/menus/${claveRol}`, {
        menus: [...(permisos[claveRol] ?? [])],
      })
      setGuardado(claveRol)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setGuardando(null)
    }
  }

  if (cargando) return <p className="p-6 text-sm text-texto-tenue">Cargando…</p>

  const menus = estado?.menus ?? []
  const roles = estado?.roles ?? []

  // Los hijos van sangrados bajo su grupo, y solo si el grupo existe.
  const ordenados = menus.slice().sort((a, b) => a.orden - b.orden)

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <Link
          to="/usuarios"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-texto-tenue hover:text-texto"
        >
          <ArrowLeft size={15} />
          Usuarios
        </Link>
        <h1 className="text-xl font-semibold text-texto">Menús por rol</h1>
        <p className="mt-1 text-sm text-texto-tenue">
          Qué ve cada tipo de usuario al entrar. Aplica a todos los usuarios de ese rol.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-borde bg-superficie">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-borde bg-fondo-alt text-left text-xs uppercase tracking-wide text-texto-tenue">
              <th className="px-4 py-3 font-medium">Menú</th>
              {roles.map((r) => (
                <th key={r.clave} className="px-3 py-3 text-center font-medium">
                  {r.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordenados.map((m) => (
              <tr key={m.id} className="border-b border-borde-tenue last:border-0">
                <td className={`px-4 py-2 text-texto ${m.id_padre ? 'pl-9 text-texto-tenue' : 'font-medium'}`}>
                  {m.etiqueta}
                </td>
                {roles.map((r) => {
                  const marcado = permisos[r.clave]?.has(m.id) ?? false
                  return (
                    <td key={r.clave} className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={(e) => alternar(r.clave, m, e.target.checked)}
                        className="h-4 w-4 cursor-pointer accent-[var(--primario)]"
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-fondo-alt">
              <td className="px-4 py-3 text-xs text-texto-tenue">Guardar por rol</td>
              {roles.map((r) => (
                <td key={r.clave} className="px-3 py-3 text-center">
                  <button
                    onClick={() => void guardar(r.clave)}
                    disabled={guardando === r.clave}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                      guardado === r.clave
                        ? 'bg-primario/10 text-primario'
                        : 'bg-primario text-white'
                    } disabled:opacity-50`}
                  >
                    {guardado === r.clave ? <Check size={12} /> : <Save size={12} />}
                    {guardando === r.clave ? '…' : guardado === r.clave ? 'Guardado' : 'Guardar'}
                  </button>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-3 text-xs text-texto-tenue">
        Un usuario ve los cambios al recargar. Los permisos se aplican también en el API: aunque
        alguien escriba la dirección, el servidor rechaza lo que su rol no alcanza.
      </p>
    </div>
  )
}
