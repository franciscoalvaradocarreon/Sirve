import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { avanceServicio } from '../api/avanceServicio'
import { procesoServicio } from '../api/procesoServicio'
import type {
  AgrupacionAvance,
  AvanceResumen,
  Eleccion,
  Proceso,
} from '../types'

/**
 * Reporte de avance de la captura.
 *
 * Responde a una pregunta concreta: de las casillas que le tocan a esta
 * elección, cuántas ya tienen acta capturada, y dónde están las que faltan.
 *
 * El universo sale de `casilla_eleccion`, no del total del proceso: en 2024
 * diputaciones tiene 7 485 casillas y ayuntamientos 7 440, así que comparar
 * contra el total daría un avance falso.
 */
const AGRUPACIONES: { valor: AgrupacionAvance; etiqueta: string }[] = [
  { valor: 'municipio', etiqueta: 'Municipios' },
  { valor: 'distrito_local', etiqueta: 'Distritos locales' },
  { valor: 'distrito_federal', etiqueta: 'Distritos federales' },
]

export function Avance() {
  const [parametros, setParametros] = useSearchParams()

  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [elecciones, setElecciones] = useState<Eleccion[]>([])
  const [resumen, setResumen] = useState<AvanceResumen | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const idProceso = Number(parametros.get('id_proceso')) || null
  const idEleccion = Number(parametros.get('id_eleccion')) || null
  const agrupacion = (parametros.get('agrupacion') ?? 'municipio') as AgrupacionAvance

  const proceso = procesos.find((p) => p.id === idProceso) ?? null
  const eleccion = elecciones.find((e) => e.id === idEleccion) ?? null

  const numero = (n: number) => n.toLocaleString('es-MX')
  const porcentaje = (parte: number, total: number) =>
    total > 0 ? Math.round((parte / total) * 100) : 0

  const cambiar = (cambios: Record<string, string>, limpiar: string[] = []) => {
    setParametros(
      (prev) => {
        Object.entries(cambios).forEach(([k, v]) => {
          if (v) prev.set(k, v)
          else prev.delete(k)
        })
        limpiar.forEach((k) => prev.delete(k))
        return prev
      },
      { replace: true },
    )
  }

  useEffect(() => {
    procesoServicio
      .listar()
      .then((datos) => {
        setProcesos(datos)
        if (!idProceso) {
          const activo = datos.find((p) => p.activo) ?? datos[0]
          if (activo) cambiar({ id_proceso: String(activo.id) })
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
        if (!idEleccion && datos.length > 0) {
          cambiar({ id_eleccion: String(datos[0].id) })
        }
      })
      .catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idProceso])

  useEffect(() => {
    if (!idEleccion) {
      setResumen(null)
      return
    }
    setCargando(true)
    setError(null)
    avanceServicio
      .resumir(idEleccion, agrupacion)
      .then(setResumen)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [idEleccion, agrupacion])

  const totalPct = useMemo(
    () =>
      resumen ? porcentaje(resumen.capturadas, resumen.casillas) : 0,
    [resumen],
  )

  const clasesSelect =
    'rounded-lg border border-borde bg-superficie px-3 py-1.5 text-sm text-texto'

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-texto">Avance</h1>
        <p className="mt-1 text-sm text-texto-tenue">
          {eleccion && proceso
            ? `${proceso.anio} · ${eleccion.nombre}`
            : 'Casillas capturadas contra las que le tocan a la elección.'}
        </p>
      </header>

      {/* Selección compacta, igual que en la captura */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 text-sm text-texto-tenue">
          Proceso
          <select
            value={idProceso ?? ''}
            onChange={(e) =>
              cambiar({ id_proceso: e.target.value }, ['id_eleccion'])
            }
            className={clasesSelect}
          >
            {procesos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.anio} · {p.activo ? 'vigente' : p.estado.toLowerCase()}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-texto-tenue">
          Elección
          <select
            value={idEleccion ?? ''}
            onChange={(e) => cambiar({ id_eleccion: e.target.value })}
            className={clasesSelect}
            disabled={elecciones.length === 0}
          >
            {elecciones.length === 0 && <option value="">Sin elecciones</option>}
            {elecciones.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex rounded-lg border border-borde bg-superficie p-0.5">
          {AGRUPACIONES.map((a) => (
            <button
              key={a.valor}
              onClick={() => cambiar({ agrupacion: a.valor })}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${
                agrupacion === a.valor
                  ? 'bg-primario text-white'
                  : 'text-texto-tenue hover:text-texto'
              }`}
            >
              {a.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Resumen grande: el dato que se viene a ver */}
      {resumen && (
        <div className="mb-4 rounded-xl border border-borde bg-superficie p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-texto-tenue">
                Avance de la elección
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-texto">
                {totalPct}%
              </p>
              <p className="mt-1 text-sm text-texto-tenue">
                {numero(resumen.capturadas)} de {numero(resumen.casillas)} casillas
                {resumen.casillas > resumen.capturadas && (
                  <> · faltan {numero(resumen.casillas - resumen.capturadas)}</>
                )}
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-texto-tenue">
                Completas
              </p>
              <p className="mt-1 text-lg font-medium tabular-nums text-texto">
                {resumen.filas.filter((f) => f.capturadas === f.casillas).length} de{' '}
                {resumen.filas.length}
              </p>
              <p className="text-sm text-texto-tenue">
                {AGRUPACIONES.find((a) => a.valor === agrupacion)?.etiqueta.toLowerCase()}
              </p>
            </div>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-fondo-alt">
            <div
              className="h-full rounded-full bg-primario transition-all"
              style={{ width: `${totalPct}%` }}
            />
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-tenue">
              <th className="px-4 py-3 font-medium">Clave</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 text-right font-medium">Casillas</th>
              <th className="px-4 py-3 text-right font-medium">Capturadas</th>
              <th className="w-40 px-4 py-3 font-medium">Avance</th>
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

            {!cargando && resumen && resumen.filas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-texto-tenue">
                  Esta elección no tiene casillas declaradas.
                </td>
              </tr>
            )}

            {!cargando &&
              resumen?.filas.map((f) => {
                const pct = porcentaje(f.capturadas, f.casillas)
                const completa = f.capturadas === f.casillas
                return (
                  <tr key={f.id} className="border-b border-borde last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs text-texto-tenue">
                      {f.clave}
                    </td>
                    <td className="px-4 py-2.5 text-texto">{f.nombre}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-texto-tenue">
                      {numero(f.casillas)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-texto">
                      {numero(f.capturadas)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fondo-alt">
                          <div
                            className={`h-full rounded-full transition-all ${
                              completa ? 'bg-primario' : 'bg-primario/60'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-xs tabular-nums text-texto-tenue">
                          {pct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
          </tbody>

          {!cargando && resumen && resumen.filas.length > 0 && (
            <tfoot>
              <tr className="border-t border-borde bg-fondo-alt">
                <td colSpan={2} className="px-4 py-2.5 text-xs uppercase tracking-wide text-texto-tenue">
                  Total · {numero(resumen.filas.length)} filas
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums text-texto">
                  {numero(resumen.casillas)}
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums text-texto">
                  {numero(resumen.capturadas)}
                </td>
                <td className="px-4 py-2.5 text-xs tabular-nums text-texto-tenue">
                  {totalPct}%
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
