import { useEffect, useState } from 'react'
import { Check, Plus, Save } from 'lucide-react'
import { cliente } from '../api/cliente'

interface Partido {
  id: number
  clave: string
  nombre: string
  color: string | null
  orden: number
  activo: boolean
}

/**
 * Catálogo de partidos.
 *
 * El color que se pone aquí es el oficial del partido: se copia a sus opciones
 * de boleta y de ahí sale el color de las barras en la sala y en el tablero.
 * Las coaliciones no se editan aquí porque tienen su propio color.
 */
export function Partidos() {
  const [partidos, setPartidos] = useState<Partido[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<number | null>(null)
  const [guardado, setGuardado] = useState<number | null>(null)
  const [creando, setCreando] = useState(false)
  const [nuevo, setNuevo] = useState({ clave: '', nombre: '', color: '#546E7A' })

  const cargar = () =>
    cliente
      .get<Partido[]>('/catalogos/partidos')
      .then((r) => setPartidos(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar'))

  useEffect(() => {
    void cargar().finally(() => setCargando(false))
  }, [])

  function editar(id: number, cambios: Partial<Partido>) {
    setPartidos((prev) => prev.map((p) => (p.id === id ? { ...p, ...cambios } : p)))
    setGuardado(null)
  }

  async function guardar(p: Partido) {
    setGuardando(p.id)
    setError(null)
    try {
      await cliente.put(`/catalogos/partidos/${p.id}`, {
        nombre: p.nombre,
        color: p.color,
        orden: p.orden,
        activo: p.activo,
      })
      setGuardado(p.id)
      window.setTimeout(() => setGuardado(null), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setGuardando(null)
    }
  }

  async function crear() {
    setError(null)
    try {
      await cliente.post('/catalogos/partidos', { ...nuevo, orden: 0, activo: true })
      setCreando(false)
      setNuevo({ clave: '', nombre: '', color: '#546E7A' })
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear')
    }
  }

  if (cargando) return <p className="p-6 text-sm text-texto-tenue">Cargando…</p>

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-texto">Partidos</h1>
          <p className="mt-1 text-sm text-texto-tenue">
            El color de cada partido se usa en las gráficas de resultados.
          </p>
        </div>
        <button
          onClick={() => setCreando((v) => !v)}
          className="flex items-center gap-2 rounded-lg bg-primario px-3 py-2 text-sm font-medium text-white"
        >
          <Plus size={16} />
          Nuevo partido
        </button>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {creando && (
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-borde bg-superficie p-3">
          <label className="text-xs text-texto-tenue">
            Clave
            <input
              value={nuevo.clave}
              onChange={(e) => setNuevo({ ...nuevo, clave: e.target.value.toUpperCase() })}
              placeholder="PAN"
              className="mt-1 block w-24 rounded-lg border border-borde bg-superficie px-2 py-1.5 text-sm text-texto"
            />
          </label>
          <label className="flex-1 text-xs text-texto-tenue">
            Nombre
            <input
              value={nuevo.nombre}
              onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
              placeholder="Partido Acción Nacional"
              className="mt-1 block w-full rounded-lg border border-borde bg-superficie px-2 py-1.5 text-sm text-texto"
            />
          </label>
          <label className="text-xs text-texto-tenue">
            Color
            <input
              type="color"
              value={nuevo.color}
              onChange={(e) => setNuevo({ ...nuevo, color: e.target.value.toUpperCase() })}
              className="mt-1 block h-9 w-16 cursor-pointer rounded border border-borde bg-superficie"
            />
          </label>
          <button
            onClick={() => void crear()}
            disabled={!nuevo.clave || !nuevo.nombre}
            className="rounded-lg bg-primario px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Crear
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-borde bg-fondo-alt text-left text-xs uppercase tracking-wide text-texto-tenue">
              <th className="px-3 py-2 font-medium">Color</th>
              <th className="px-3 py-2 font-medium">Clave</th>
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 font-medium">Orden</th>
              <th className="px-3 py-2 font-medium">Activo</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {partidos.map((p) => (
              <tr key={p.id} className="border-b border-borde-tenue last:border-0">
                <td className="px-3 py-2">
                  <input
                    type="color"
                    value={p.color ?? '#546E7A'}
                    onChange={(e) => editar(p.id, { color: e.target.value.toUpperCase() })}
                    className="h-8 w-12 cursor-pointer rounded border border-borde bg-superficie"
                    title="Color del partido"
                  />
                </td>
                <td className="px-3 py-2 font-mono text-xs text-texto">{p.clave}</td>
                <td className="px-3 py-2">
                  <input
                    value={p.nombre}
                    onChange={(e) => editar(p.id, { nombre: e.target.value })}
                    className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-texto hover:border-borde focus:border-borde focus:bg-superficie"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={p.orden}
                    onChange={(e) => editar(p.id, { orden: Number(e.target.value) })}
                    className="w-16 rounded border border-borde bg-superficie px-2 py-1 text-xs text-texto"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={p.activo}
                    onChange={(e) => editar(p.id, { activo: e.target.checked })}
                    className="h-4 w-4 cursor-pointer"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => void guardar(p)}
                    disabled={guardando === p.id}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                      guardado === p.id
                        ? 'bg-primario/10 text-primario'
                        : 'bg-primario text-white'
                    } disabled:opacity-50`}
                  >
                    {guardado === p.id ? <Check size={12} /> : <Save size={12} />}
                    {guardando === p.id ? '…' : guardado === p.id ? 'Guardado' : 'Guardar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-texto-tenue">
        Cambiar el color aquí lo cambia en las boletas de todas las elecciones, y de ahí en las
        gráficas. La clave no se puede editar: se usa en los nombres de archivo de las actas.
      </p>
    </div>
  )
}
