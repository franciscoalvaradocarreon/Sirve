import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, TriangleAlert } from 'lucide-react'
import { cliente } from '../api/cliente'
import { procesoServicio } from '../api/procesoServicio'
import type { Eleccion, Proceso } from '../types'

/** Una fila del reporte: una sección asignada a un capturista. */
interface Asignacion {
  id_capturista: number
  capturista: string
  municipio: string
  seccion: string
  casillas: number
  capturadas: number
  otros: number
}

/**
 * Reporte de asignación.
 *
 * Responde a dos preguntas de operación: quién cubre qué, y qué secciones
 * quedaron con dos personas o con ninguna captura todavía.
 *
 * El avance se mide contra las casillas de la sección en la elección elegida,
 * no contra el total del proceso.
 */
export function AsignacionReporte() {
  const [parametros, setParametros] = useSearchParams()

  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [elecciones, setElecciones] = useState<Eleccion[]>([])
  const [filas, setFilas] = useState<Asignacion[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const idProceso = Number(parametros.get('id_proceso')) || null
  const idEleccion = Number(parametros.get('id_eleccion')) || null

  const numero = (n: number) => n.toLocaleString('es-MX')

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
      .get<Asignacion[]>('/reportes/asignacion', { params: { id_eleccion: idEleccion } })
      .then((r) => setFilas(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [idEleccion])

  const filtradas = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    if (!t) return filas
    return filas.filter(
      (f) =>
        f.capturista.toLowerCase().includes(t) ||
        f.municipio.toLowerCase().includes(t) ||
        f.seccion.includes(t),
    )
  }, [filas, busqueda])

  /** Agrupadas por capturista, que es como se lee una asignación. */
  const porPersona = useMemo(() => {
    const mapa = new Map<number, { nombre: string; secciones: Asignacion[] }>()
    filtradas.forEach((f) => {
      const actual = mapa.get(f.id_capturista) ?? { nombre: f.capturista, secciones: [] }
      actual.secciones.push(f)
      mapa.set(f.id_capturista, actual)
    })
    return [...mapa.entries()]
      .map(([id, v]) => ({
        id,
        nombre: v.nombre,
        secciones: v.secciones,
        casillas: v.secciones.reduce((t, s) => t + s.casillas, 0),
        capturadas: v.secciones.reduce((t, s) => t + s.capturadas, 0),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [filtradas])

  const totales = useMemo(
    () => ({
      secciones: filtradas.length,
      casillas: filtradas.reduce((t, f) => t + f.casillas, 0),
      capturadas: filtradas.reduce((t, f) => t + f.capturadas, 0),
      compartidas: filtradas.filter((f) => f.otros > 0).length,
    }),
    [filtradas],
  )

  const clasesSelect =
    'rounded-lg border border-borde bg-superficie px-3 py-1.5 text-sm text-texto'

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-texto">Asignación</h1>
        <p className="mt-1 text-sm text-texto-tenue">
          Secciones que cubre cada capturista y cómo van.
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

        <label className="relative ml-auto w-56">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue"
          />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Capturista, municipio o sección…"
            className="w-full rounded-lg border border-borde bg-superficie py-2 pl-9 pr-3 text-sm text-texto placeholder:text-texto-tenue"
          />
        </label>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Resumen */}
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {[
          ['Secciones', totales.secciones],
          ['Casillas', totales.casillas],
          ['Capturadas', totales.capturadas],
          ['Compartidas', totales.compartidas],
        ].map(([etiqueta, valor]) => (
          <div key={String(etiqueta)} className="rounded-xl border border-borde bg-superficie p-4">
            <p className="text-xs uppercase tracking-wide text-texto-tenue">{etiqueta}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-texto">
              {numero(Number(valor))}
            </p>
          </div>
        ))}
      </div>

      {cargando && <p className="py-6 text-center text-sm text-texto-tenue">Cargando…</p>}

      {!cargando && porPersona.length === 0 && (
        <p className="rounded-xl border border-borde bg-superficie p-8 text-center text-sm text-texto-tenue">
          Ningún capturista tiene secciones asignadas en esta elección.
        </p>
      )}

      <div className="space-y-3">
        {porPersona.map((p) => (
          <div key={p.id} className="overflow-hidden rounded-xl border border-borde bg-superficie">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde bg-fondo-alt px-4 py-2.5">
              <p className="text-sm font-medium text-texto">{p.nombre}</p>
              <p className="text-xs tabular-nums text-texto-tenue">
                {numero(p.secciones.length)} secciones · {numero(p.casillas)} casillas ·{' '}
                {numero(p.capturadas)} capturadas
              </p>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-texto-tenue">
                  <th className="px-4 py-2 font-medium">Sección</th>
                  <th className="px-4 py-2 font-medium">Municipio</th>
                  <th className="px-4 py-2 text-right font-medium">Casillas</th>
                  <th className="px-4 py-2 text-right font-medium">Capturadas</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {p.secciones.map((s) => (
                  <tr key={s.seccion} className="border-t border-borde-tenue">
                    <td className="px-4 py-2 font-mono text-xs text-texto">{s.seccion}</td>
                    <td className="px-4 py-2 text-texto-tenue">{s.municipio}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-texto-tenue">
                      {numero(s.casillas)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-texto">
                      {numero(s.capturadas)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {s.otros > 0 && (
                        <span
                          className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"
                          title={`${s.otros} persona(s) más cubren esta sección`}
                        >
                          <TriangleAlert size={12} />
                          compartida
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  )
}
