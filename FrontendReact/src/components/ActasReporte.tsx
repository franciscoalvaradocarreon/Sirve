import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Image as ImageIcon, Search } from 'lucide-react'
import { cliente } from '../api/cliente'
import { procesoServicio } from '../api/procesoServicio'
import type { Eleccion, Proceso } from '../types'

/** Un acta con foto registrada. */
interface Acta {
  id_casilla: number
  municipio: string
  seccion: string
  casilla: string
  ruta: string
  bytes: number
  subida_en: string
  capturista: string | null
}

/**
 * Reporte de actas con foto.
 *
 * Solo lista lo que **ya tiene** acta registrada: es un inventario de lo que
 * existe, no de lo que falta. Se puede abrir cada imagen para revisarla.
 */
export function ActasReporte() {
  const [parametros, setParametros] = useSearchParams()

  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [elecciones, setElecciones] = useState<Eleccion[]>([])
  const [filas, setFilas] = useState<Acta[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const idProceso = Number(parametros.get('id_proceso')) || null
  const idEleccion = Number(parametros.get('id_eleccion')) || null

  const numero = (n: number) => n.toLocaleString('es-MX')

  const peso = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

  const cambiar = (clave: string, valor: string, limpiar: string[] = []) => {
    setParametros(
      (prev) => {
        if (valor) prev.set(clave, valor)
        else prev.delete(clave)
        limpiar.forEach((k) => prev.delete(k))
        return prev
      },
      { replace: true },
    )
  }

  useEffect(() => {
    procesoServicio
      .listar()
      .then((ps) => {
        setProcesos(ps)
        if (!idProceso) {
          const activo = ps.find((p) => p.activo) ?? ps[0]
          if (activo) cambiar('id_proceso', String(activo.id))
        }
      })
      .catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!idProceso) return
    procesoServicio
      .elecciones(idProceso)
      .then((datos) => {
        setElecciones(datos)
        if (!idEleccion && datos.length > 0) cambiar('id_eleccion', String(datos[0].id))
      })
      .catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idProceso])

  useEffect(() => {
    if (!idEleccion) {
      setFilas([])
      return
    }
    setCargando(true)
    setError(null)
    cliente
      .get<Acta[]>('/reportes/actas', { params: { id_eleccion: idEleccion } })
      .then((r) => setFilas(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [idEleccion])

  const filtradas = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    if (!t) return filas
    return filas.filter(
      (f) =>
        f.municipio.toLowerCase().includes(t) ||
        f.seccion.includes(t) ||
        (f.capturista ?? '').toLowerCase().includes(t),
    )
  }, [filas, busqueda])

  const totales = useMemo(
    () => ({
      actas: filtradas.length,
      bytes: filtradas.reduce((t, f) => t + f.bytes, 0),
    }),
    [filtradas],
  )

  const clasesSelect =
    'rounded-lg border border-borde bg-superficie px-3 py-1.5 text-sm text-texto'

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-texto">Actas</h1>
        <p className="mt-1 text-sm text-texto-tenue">
          Casillas con foto del acta registrada.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 text-sm text-texto-tenue">
          Proceso
          <select
            value={idProceso ?? ''}
            onChange={(e) => cambiar('id_proceso', e.target.value, ['id_eleccion'])}
            className={clasesSelect}
          >
            {procesos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.anio}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-texto-tenue">
          Elección
          <select
            value={idEleccion ?? ''}
            onChange={(e) => cambiar('id_eleccion', e.target.value)}
            className={clasesSelect}
            disabled={elecciones.length === 0}
          >
            {elecciones.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="relative ml-auto w-64">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue"
          />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Municipio, sección o capturista…"
            className="w-full rounded-lg border border-borde bg-superficie py-2 pl-9 pr-3 text-sm text-texto placeholder:text-texto-tenue"
          />
        </label>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-borde bg-superficie p-4">
          <p className="text-xs uppercase tracking-wide text-texto-tenue">Actas</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-texto">
            {numero(totales.actas)}
          </p>
        </div>
        <div className="rounded-xl border border-borde bg-superficie p-4">
          <p className="text-xs uppercase tracking-wide text-texto-tenue">Ocupan</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-texto">
            {peso(totales.bytes)}
          </p>
        </div>
        <div className="rounded-xl border border-borde bg-superficie p-4">
          <p className="text-xs uppercase tracking-wide text-texto-tenue">Promedio</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-texto">
            {totales.actas > 0 ? peso(Math.round(totales.bytes / totales.actas)) : '—'}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-tenue">
              <th className="px-3 py-3 font-medium" />
              <th className="px-3 py-3 font-medium">Sección</th>
              <th className="px-3 py-3 font-medium">Casilla</th>
              <th className="px-3 py-3 font-medium">Municipio</th>
              <th className="px-3 py-3 font-medium">Capturista</th>
              <th className="px-3 py-3 font-medium">Subida</th>
              <th className="px-3 py-3 text-right font-medium">Peso</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-texto-tenue">
                  Cargando…
                </td>
              </tr>
            )}

            {!cargando && filtradas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-texto-tenue">
                  <ImageIcon size={20} className="mx-auto mb-2 opacity-40" />
                  Todavía no hay actas con foto en esta elección.
                </td>
              </tr>
            )}

            {filtradas.map((a) => (
              <tr key={`${a.id_casilla}`} className="border-b border-borde last:border-0">
                <td className="px-3 py-2">
                  <a
                    href={`/api/actas/${a.id_casilla}/${idEleccion}/imagen`}
                    target="_blank"
                    rel="noreferrer"
                    title="Abrir la imagen"
                  >
                    <img
                      src={`/api/actas/${a.id_casilla}/${idEleccion}/imagen`}
                      alt={`Acta ${a.casilla}`}
                      loading="lazy"
                      className="h-10 w-14 rounded border border-borde object-cover"
                    />
                  </a>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-texto">{a.seccion}</td>
                <td className="px-3 py-2 font-mono text-xs text-texto-tenue">{a.casilla}</td>
                <td className="px-3 py-2 text-texto">{a.municipio}</td>
                <td className="px-3 py-2 text-texto-tenue">{a.capturista ?? '—'}</td>
                <td className="px-3 py-2 text-texto-tenue">
                  {new Date(a.subida_en).toLocaleString('es-MX', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-texto-tenue">
                  {peso(a.bytes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
