import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { casillaServicio } from '../api/casillaServicio'
import { procesoServicio } from '../api/procesoServicio'
import type { Casilla, Eleccion, Proceso } from '../types'

/** Cuántas filas se pintan de entrada y cuántas se agregan con «Mostrar más». */
const TANDA = 300

/**
 * Catálogo de casillas.
 *
 * Se descarga la lista completa de la elección una vez y se filtra en el
 * navegador. Son unas 7 500 filas de un solo proceso: caben de sobra en
 * memoria, y así los cuatro filtros responden al instante en lugar de hacer
 * una petición por cada cambio.
 *
 * El proceso y la elección viven en la URL; los filtros, no.
 */
export function Casillas() {
  const [parametros, setParametros] = useSearchParams()

  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [elecciones, setElecciones] = useState<Eleccion[]>([])
  const [casillas, setCasillas] = useState<Casilla[]>([])

  const [distritoFederal, setDistritoFederal] = useState('')
  const [distritoLocal, setDistritoLocal] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [seccion, setSeccion] = useState('')
  const [visibles, setVisibles] = useState(TANDA)

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const idProceso = Number(parametros.get('id_proceso')) || null
  const idEleccion = Number(parametros.get('id_eleccion')) || null

  const numero = (n: number) => n.toLocaleString('es-MX')

  // Procesos y elecciones: dos consultas encadenadas una sola vez
  useEffect(() => {
    procesoServicio
      .listar()
      .then(async (ps) => {
        setProcesos(ps)
        const proceso = ps.find((p) => p.id === idProceso) ?? ps.find((p) => p.activo) ?? ps[0]
        const es = await procesoServicio.elecciones(proceso.id)
        setElecciones(es)
        if (!idProceso || !idEleccion) {
          const eleccion = es[0]
          setParametros(
            (prev) => {
              prev.set('id_proceso', String(proceso.id))
              if (eleccion) prev.set('id_eleccion', String(eleccion.id))
              return prev
            },
            { replace: true },
          )
        }
      })
      .catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Al cambiar de proceso, se recargan sus elecciones
  useEffect(() => {
    if (!idProceso) return
    procesoServicio
      .elecciones(idProceso)
      .then(setElecciones)
      .catch((e) => setError(e.message))
  }, [idProceso])

  // Casillas de la elección
  useEffect(() => {
    if (!idEleccion) {
      setCasillas([])
      return
    }
    setCargando(true)
    casillaServicio
      .listar(idEleccion)
      .then(setCasillas)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [idEleccion])

  // Al cambiar de elección, los filtros anteriores dejan de tener sentido
  useEffect(() => {
    setDistritoFederal('')
    setDistritoLocal('')
    setMunicipio('')
    setSeccion('')
    setVisibles(TANDA)
  }, [idEleccion])

  const municipios = useMemo(
    () => [...new Set(casillas.map((c) => c.municipio))].sort(),
    [casillas],
  )

  const distritosFederales = useMemo(
    () => [...new Set(casillas.map((c) => c.distrito_federal).filter((d): d is string => !!d))].sort(),
    [casillas],
  )

  const distritosLocales = useMemo(
    () => [...new Set(casillas.map((c) => c.distrito_local).filter((d): d is string => !!d))].sort(),
    [casillas],
  )

  const filtradas = useMemo(() => {
    const sec = seccion.trim()
    return casillas.filter((c) => {
      if (municipio && c.municipio !== municipio) return false
      if (distritoFederal && c.distrito_federal !== distritoFederal) return false
      if (distritoLocal && c.distrito_local !== distritoLocal) return false
      if (sec && c.seccion !== sec) return false
      return true
    })
  }, [casillas, municipio, distritoFederal, distritoLocal, seccion])

  const capturadas = useMemo(() => filtradas.filter((c) => c.capturada).length, [filtradas])

  const hayFiltros = !!municipio || !!distritoFederal || !!distritoLocal || !!seccion
  const mostradas = filtradas.slice(0, visibles)
  const restantes = filtradas.length - mostradas.length

  const limpiar = () => {
    setDistritoFederal('')
    setDistritoLocal('')
    setMunicipio('')
    setSeccion('')
    setVisibles(TANDA)
  }

  const clasesSelect =
    'rounded-lg border border-borde bg-superficie px-3 py-1.5 text-sm text-texto disabled:opacity-50'

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-texto">Casillas</h1>
          <p className="mt-1 text-sm text-texto-tenue">
            {numero(filtradas.length)} de {numero(casillas.length)} casillas ·{' '}
            {numero(capturadas)} capturadas
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-2 text-sm text-texto-tenue">
            Proceso
            <select
              value={idProceso ?? ''}
              onChange={(e) => {
                const p = Number(e.target.value)
                setParametros((prev) => {
                  prev.set('id_proceso', String(p))
                  prev.delete('id_eleccion')
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

          <label className="flex items-center gap-2 text-sm text-texto-tenue">
            Elección
            <select
              value={idEleccion ?? ''}
              onChange={(e) => {
                const el = Number(e.target.value)
                setParametros((prev) => {
                  prev.set('id_eleccion', String(el))
                  return prev
                })
              }}
              className={clasesSelect}
            >
              {elecciones.map((el) => (
                <option key={el.id} value={el.id}>
                  {el.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

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
            value={municipio}
            onChange={(e) => {
              setMunicipio(e.target.value)
              setVisibles(TANDA)
            }}
            className={clasesSelect}
          >
            <option value="">Todos</option>
            {municipios.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-texto-tenue">
          Sección
          <input
            value={seccion}
            onChange={(e) => {
              setSeccion(e.target.value.replace(/\D/g, ''))
              setVisibles(TANDA)
            }}
            inputMode="numeric"
            placeholder="Todas"
            className="w-24 rounded-lg border border-borde bg-superficie px-3 py-1.5 text-sm text-texto placeholder:text-texto-tenue focus:border-primario focus:outline-none"
          />
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
              <th className="px-4 py-3 font-medium">Casilla</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Municipio</th>
              <th className="px-4 py-3 font-medium">Sección</th>
              <th className="px-4 py-3 font-medium">D. local</th>
              <th className="px-4 py-3 font-medium">D. federal</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-texto-tenue">
                  Cargando casillas…
                </td>
              </tr>
            )}

            {!cargando && filtradas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-texto-tenue">
                  {casillas.length === 0
                    ? 'Esta elección no tiene casillas.'
                    : 'Ninguna casilla coincide con los filtros.'}
                </td>
              </tr>
            )}

            {!cargando &&
              mostradas.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-borde transition-colors last:border-0 hover:bg-fondo-alt"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-texto">{c.clave}</td>
                  <td className="px-4 py-2.5 text-texto-tenue">{c.tipo}</td>
                  <td className="px-4 py-2.5 text-texto-tenue">{c.municipio}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-texto-tenue">{c.seccion}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-texto-tenue">
                    {c.distrito_local ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-texto-tenue">
                    {c.distrito_federal ?? '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={[
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs',
                        c.capturada
                          ? 'bg-primario-suave text-primario-texto'
                          : 'bg-fondo-alt text-texto-tenue',
                      ].join(' ')}
                    >
                      {c.capturada ? 'Capturada' : 'Pendiente'}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>

          {!cargando && filtradas.length > 0 && (
            <tfoot>
              <tr className="border-t border-borde bg-fondo-alt">
                <td colSpan={6} className="px-4 py-2.5 text-xs uppercase tracking-wide text-texto-tenue">
                  Total · {numero(filtradas.length)}{' '}
                  {filtradas.length === 1 ? 'casilla' : 'casillas'} ·{' '}
                  {numero(capturadas)} capturadas
                </td>
                <td className="px-4 py-2.5 text-right text-xs tabular-nums text-texto-tenue">
                  {numero(filtradas.length - capturadas)} pendientes
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
    </div>
  )
}
