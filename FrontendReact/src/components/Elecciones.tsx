import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { procesoServicio } from '../api/procesoServicio'
import type { Eleccion, Proceso } from '../types'

/**
 * Catálogo de elecciones.
 *
 * No solo lista: muestra de cada elección cuántas casillas y opciones tiene
 * —es decir, si está lista para capturar— y cuánto avance lleva. Una
 * elección sin casillas o sin boleta se ve de inmediato y no hay que
 * descubrirlo al abrir la pantalla de captura.
 */
export function Elecciones() {
  const [parametros, setParametros] = useSearchParams()

  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [elecciones, setElecciones] = useState<Eleccion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const idProceso = Number(parametros.get('id_proceso')) || null
  const proceso = procesos.find((p) => p.id === idProceso) ?? null

  const numero = (n: number) => n.toLocaleString('es-MX')

  useEffect(() => {
    procesoServicio
      .listar()
      .then((datos) => {
        setProcesos(datos)
        if (!idProceso) {
          const activo = datos.find((p) => p.activo) ?? datos[0]
          if (activo) {
            setParametros(
              (prev) => {
                prev.set('id_proceso', String(activo.id))
                return prev
              },
              { replace: true },
            )
          }
        }
      })
      .catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!idProceso) return
    setCargando(true)
    procesoServicio
      .elecciones(idProceso)
      .then(setElecciones)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [idProceso])

  const totales = useMemo(
    () => ({
      casillas: elecciones.reduce((s, e) => s + e.casillas, 0),
      capturadas: elecciones.reduce((s, e) => s + e.capturadas, 0),
    }),
    [elecciones],
  )

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-texto">Elecciones</h1>
          <p className="mt-1 text-sm text-texto-tenue">
            {elecciones.length} {elecciones.length === 1 ? 'elección' : 'elecciones'} ·{' '}
            {numero(totales.casillas)} casillas · {numero(totales.capturadas)} capturadas
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-texto-tenue">
          Proceso
          <select
            value={idProceso ?? ''}
            onChange={(e) => {
              const p = Number(e.target.value)
              setParametros((prev) => {
                prev.set('id_proceso', String(p))
                return prev
              })
            }}
            className="rounded-lg border border-borde bg-superficie px-3 py-1.5 text-sm text-texto"
          >
            {procesos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.anio} · {p.activo ? 'vigente' : p.estado.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-tenue">
              <th className="px-4 py-3 font-medium">Clave</th>
              <th className="px-4 py-3 font-medium">Elección</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 text-right font-medium">Casillas</th>
              <th className="px-4 py-3 text-right font-medium">Boleta</th>
              <th className="px-4 py-3 font-medium">Avance</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-texto-tenue">
                  Cargando…
                </td>
              </tr>
            )}

            {!cargando && elecciones.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-texto-tenue">
                  {proceso && proceso.anio === 2027
                    ? 'Este proceso todavía no tiene elecciones.'
                    : 'Este proceso no tiene elecciones.'}
                </td>
              </tr>
            )}

            {!cargando &&
              elecciones.map((e) => {
                const pct = e.casillas > 0 ? Math.round((e.capturadas / e.casillas) * 100) : 0
                const lista = e.casillas > 0 && e.opciones > 0
                return (
                  <tr
                    key={e.id}
                    className="border-b border-borde transition-colors last:border-0 hover:bg-fondo-alt"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-texto-tenue">{e.clave}</td>
                    <td className="px-4 py-3 text-texto">{e.nombre}</td>
                    <td className="px-4 py-3 text-xs text-texto-tenue">{e.tipo}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-texto">
                      {numero(e.casillas)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-texto">
                      {numero(e.opciones)}
                    </td>
                    <td className="px-4 py-3">
                      {!lista ? (
                        <span className="text-xs text-texto-tenue">Sin configurar</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-fondo-alt">
                            <div
                              className="h-full rounded-full bg-primario"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="tabular-nums text-xs text-texto-tenue">
                            {numero(e.capturadas)} · {pct}%
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-texto-tenue">
        «Sin configurar» significa que a la elección le falta la boleta o las casillas: todavía
        no se puede capturar en ella.
      </p>
    </div>
  )
}
