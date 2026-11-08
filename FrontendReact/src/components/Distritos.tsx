import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { distritoServicio } from '../api/distritoServicio'
import { procesoServicio } from '../api/procesoServicio'
import type { Distrito, Proceso } from '../types'

type TipoDistrito = 'LOCAL' | 'FEDERAL'

/**
 * Catálogo de distritos.
 *
 * Es un solo catálogo: locales y federales viven en la misma tabla y solo se
 * distinguen por el tipo. Por eso la pantalla es una y el tipo se elige
 * adentro, en lugar de repetir dos menús para la misma tabla.
 */
export function Distritos() {
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [proceso, setProceso] = useState<Proceso | null>(null)
  const [tipo, setTipo] = useState<TipoDistrito>('LOCAL')
  const [distritos, setDistritos] = useState<Distrito[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    procesoServicio
      .listar()
      .then((datos) => {
        setProcesos(datos)
        const activo = datos.find((p) => p.activo) ?? datos[0]
        if (activo) setProceso(activo)
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    if (!proceso) return
    setCargando(true)
    distritoServicio
      .listar(tipo, proceso.id)
      .then(setDistritos)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [proceso, tipo])

  const filtrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    if (!t) return distritos
    return distritos.filter((d) => d.nombre.toLowerCase().includes(t) || d.clave.includes(t))
  }, [distritos, busqueda])

  const totalSecciones = useMemo(
    () => distritos.reduce((suma, d) => suma + d.secciones, 0),
    [distritos],
  )

  // Total de las filas visibles: si hay búsqueda, suma solo lo que se ve.
  const totalVisibles = useMemo(
    () => filtrados.reduce((suma, d) => suma + d.secciones, 0),
    [filtrados],
  )

  const numero = (n: number) => n.toLocaleString('es-MX')

  const gentilicio = tipo === 'LOCAL' ? 'locales' : 'federales'

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-texto">Distritos</h1>
            <p className="mt-1 text-sm text-texto-tenue">
              {numero(distritos.length)} distritos {gentilicio} · {numero(totalSecciones)} secciones
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-texto-tenue">
            Proceso
            <select
              value={proceso?.id ?? ''}
              onChange={(e) => {
                const elegido = procesos.find((p) => p.id === Number(e.target.value))
                if (elegido) setProceso(elegido)
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
        </div>

        {/* Tipo: dos botones en lugar de un select, porque son solo dos opciones */}
        <div className="mt-4 inline-flex rounded-lg border border-borde bg-superficie p-0.5">
          {(['LOCAL', 'FEDERAL'] as TipoDistrito[]).map((t) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={[
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                tipo === t
                  ? 'bg-primario-suave font-medium text-primario-texto'
                  : 'text-texto-tenue hover:text-texto',
              ].join(' ')}
            >
              {t === 'LOCAL' ? 'Locales' : 'Federales'}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="relative mb-4">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue"
        />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o clave…"
          className="w-full rounded-lg border border-borde bg-superficie py-2 pl-9 pr-3 text-sm text-texto placeholder:text-texto-tenue focus:border-primario focus:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-tenue">
              <th className="px-4 py-3 font-medium">Clave</th>
              <th className="px-4 py-3 font-medium">Distrito</th>

              <th className="px-4 py-3 text-right font-medium">Secciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-texto-tenue">
                  Cargando…
                </td>
              </tr>
            )}

            {!cargando && filtrados.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-texto-tenue">
                  {distritos.length === 0
                    ? `No hay distritos ${gentilicio} en el catálogo.`
                    : 'Ningún distrito coincide con la búsqueda.'}
                </td>
              </tr>
            )}

            {!cargando &&
              filtrados.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-borde transition-colors last:border-0 hover:bg-fondo-alt"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-texto-tenue">{d.clave}</td>
                  <td className="px-4 py-2.5 text-texto">{d.nombre}</td>

                  <td className="px-4 py-2.5 text-right tabular-nums text-texto-tenue">
                    {d.secciones > 0 ? numero(d.secciones) : '—'}
                  </td>
                </tr>
              ))}
          </tbody>

          {!cargando && filtrados.length > 0 && (
            <tfoot>
              <tr className="border-t border-borde bg-fondo-alt">
                <td colSpan={2} className="px-4 py-2.5 text-xs uppercase tracking-wide text-texto-tenue">
                  Total · {numero(filtrados.length)} {filtrados.length === 1 ? 'distrito' : 'distritos'}
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums text-texto">
                  {numero(totalVisibles)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {!cargando && distritos.length > 0 && totalSecciones === 0 && (
        <p className="mt-3 text-xs text-texto-tenue">
          Los distritos existen en el catálogo, pero este proceso no tiene secciones
          asignadas. Pasa en 2021 con los federales: esa cartografía no se cargó.
        </p>
      )}
    </div>
  )
}
