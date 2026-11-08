import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { municipioServicio } from '../api/municipioServicio'
import { procesoServicio } from '../api/procesoServicio'
import { seccionServicio } from '../api/seccionServicio'
import type { Municipio, Proceso, Seccion } from '../types'

/** Cuántas filas se pintan de entrada y cuántas se agregan con «Mostrar más». */
const TANDA = 300

/**
 * Catálogo de secciones.
 *
 * El proceso y el municipio viven en la URL, no en el estado: así el botón
 * «atrás» del navegador funciona, se puede recargar sin perder el contexto y
 * un enlace a las secciones de un municipio se puede compartir.
 *
 * Los filtros por distrito son estado local: son una vista momentánea.
 */
export function Secciones() {
  const [parametros, setParametros] = useSearchParams()

  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [municipios, setMunicipios] = useState<Municipio[]>([])
  const [secciones, setSecciones] = useState<Seccion[]>([])
  const [distritoFederal, setDistritoFederal] = useState('')
  const [distritoLocal, setDistritoLocal] = useState('')
  const [visibles, setVisibles] = useState(TANDA)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const idProceso = Number(parametros.get('id_proceso')) || null
  const idMunicipio = Number(parametros.get('id_municipio')) || null

  const numero = (n: number) => n.toLocaleString('es-MX')

  // Procesos, una sola vez
  useEffect(() => {
    procesoServicio
      .listar()
      .then((datos) => {
        setProcesos(datos)
        if (!parametros.get('id_proceso')) {
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
      .finally(() => setCargando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Municipios del proceso elegido
  useEffect(() => {
    if (!idProceso) {
      setMunicipios([])
      return
    }
    municipioServicio
      .listar(idProceso)
      .then(setMunicipios)
      .catch((e) => setError(e.message))
  }, [idProceso])

  // Secciones: del municipio elegido o, si está en «Todos», de todo el proceso
  useEffect(() => {
    if (!idProceso) {
      setSecciones([])
      return
    }
    setCargando(true)
    seccionServicio
      .listar(idMunicipio, idProceso)
      .then(setSecciones)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [idProceso, idMunicipio])

  // Al cambiar de municipio o proceso, los filtros y el avance de la lista
  // vuelven a empezar.
  useEffect(() => {
    setDistritoFederal('')
    setDistritoLocal('')
    setVisibles(TANDA)
  }, [idMunicipio, idProceso])

  // Los distritos que se ofrecen salen de las secciones cargadas: así no se
  // puede elegir uno que no tenga ninguna sección en lo que se está viendo.
  const distritosFederales = useMemo(
    () =>
      [...new Set(secciones.map((s) => s.distrito_federal).filter((d): d is string => !!d))].sort(),
    [secciones],
  )

  const distritosLocales = useMemo(
    () =>
      [...new Set(secciones.map((s) => s.distrito_local).filter((d): d is string => !!d))].sort(),
    [secciones],
  )

  const filtradas = useMemo(
    () =>
      secciones.filter(
        (s) =>
          (!distritoFederal || s.distrito_federal === distritoFederal) &&
          (!distritoLocal || s.distrito_local === distritoLocal),
      ),
    [secciones, distritoFederal, distritoLocal],
  )

  const totalCasillas = useMemo(
    () => filtradas.reduce((suma, s) => suma + s.casillas, 0),
    [filtradas],
  )

  const municipiosDistintos = useMemo(
    () => new Set(filtradas.map((s) => s.municipio)).size,
    [filtradas],
  )

  const hayFiltros = !!distritoFederal || !!distritoLocal
  const sinMunicipio = !idMunicipio
  const mostradas = filtradas.slice(0, visibles)
  const restantes = filtradas.length - mostradas.length

  const limpiar = () => {
    setDistritoFederal('')
    setDistritoLocal('')
    setVisibles(TANDA)
  }

  const clasesSelect =
    'rounded-lg border border-borde bg-superficie px-3 py-1.5 text-sm text-texto disabled:opacity-50'

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-texto">Secciones</h1>
          <p className="mt-1 text-sm text-texto-tenue">
            {numero(filtradas.length)} de {numero(secciones.length)} secciones ·{' '}
            {numero(totalCasillas)} casillas
            {sinMunicipio && ` · ${numero(municipiosDistintos)} municipios`}
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
                prev.delete('id_municipio')
                return prev
              })
            }}
            className={clasesSelect}
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

      {/* Filtros: federal, local, municipio. Con los tres en «Todos» se
          listan todas las secciones del proceso. */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 text-sm text-texto-tenue">
          Dist. federal
          <select
            value={distritoFederal}
            onChange={(e) => {
              setDistritoFederal(e.target.value)
              setVisibles(TANDA)
            }}
            className={clasesSelect}
            disabled={distritosFederales.length === 0}
          >
            <option value="">Todos</option>
            {distritosFederales.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-texto-tenue">
          Dist. local
          <select
            value={distritoLocal}
            onChange={(e) => {
              setDistritoLocal(e.target.value)
              setVisibles(TANDA)
            }}
            className={clasesSelect}
            disabled={distritosLocales.length === 0}
          >
            <option value="">Todos</option>
            {distritosLocales.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-texto-tenue">
          Municipio
          <select
            value={idMunicipio ?? ''}
            onChange={(e) => {
              const m = Number(e.target.value)
              setParametros((prev) => {
                if (m) prev.set('id_municipio', String(m))
                else prev.delete('id_municipio')
                return prev
              })
            }}
            className={clasesSelect}
          >
            <option value="">Todos</option>
            {municipios.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </label>

        {hayFiltros && (
          <button
            onClick={limpiar}
            className="flex items-center gap-1.5 rounded-lg border border-borde px-3 py-1.5 text-sm text-texto-tenue transition-colors hover:text-texto"
          >
            <X size={14} />
            Limpiar
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-tenue">
              <th className="px-4 py-3 font-medium">Sección</th>
              {sinMunicipio && <th className="px-4 py-3 font-medium">Municipio</th>}
              <th className="px-4 py-3 font-medium">Dist. local</th>
              <th className="px-4 py-3 font-medium">Dist. federal</th>
              <th className="px-4 py-3 text-right font-medium">Casillas</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={sinMunicipio ? 5 : 4} className="px-4 py-6 text-center text-texto-tenue">
                  Cargando…
                </td>
              </tr>
            )}

            {!cargando && filtradas.length === 0 && (
              <tr>
                <td colSpan={sinMunicipio ? 5 : 4} className="px-4 py-6 text-center text-texto-tenue">
                  {secciones.length === 0
                    ? 'Este proceso no tiene secciones.'
                    : 'Ninguna sección coincide con los filtros.'}
                </td>
              </tr>
            )}

            {!cargando &&
              mostradas.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-borde transition-colors last:border-0 hover:bg-fondo-alt"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-texto">{s.clave}</td>
                  {sinMunicipio && (
                    <td className="px-4 py-2.5 text-texto-tenue">{s.municipio}</td>
                  )}
                  <td className="px-4 py-2.5 font-mono text-xs text-texto-tenue">
                    {s.distrito_local ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-texto-tenue">
                    {s.distrito_federal ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-texto-tenue">
                    {s.casillas > 0 ? numero(s.casillas) : '—'}
                  </td>
                </tr>
              ))}
          </tbody>

          {!cargando && filtradas.length > 0 && (
            <tfoot>
              <tr className="border-t border-borde bg-fondo-alt">
                <td
                  colSpan={sinMunicipio ? 4 : 3}
                  className="px-4 py-2.5 text-xs uppercase tracking-wide text-texto-tenue"
                >
                  Total · {numero(filtradas.length)}{' '}
                  {filtradas.length === 1 ? 'sección' : 'secciones'}
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums text-texto">
                  {numero(totalCasillas)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {restantes > 0 && (
        <div className="mt-4 flex items-center justify-between text-xs text-texto-tenue">
          <span>
            Mostrando {numero(mostradas.length)} de {numero(filtradas.length)}
          </span>
          <button
            onClick={() => setVisibles((v) => v + TANDA)}
            className="rounded-lg border border-borde px-3 py-1.5 text-sm text-texto transition-colors hover:bg-fondo-alt"
          >
            Mostrar {numero(Math.min(TANDA, restantes))} más
          </button>
        </div>
      )}

      {!cargando && secciones.length > 0 && !secciones.some((s) => s.distrito_federal) && (
        <p className="mt-3 text-xs text-texto-tenue">
          Este proceso no tiene distrito federal asignado: la cartografía federal de 2021 no se
          cargó.
        </p>
      )}
    </div>
  )
}
