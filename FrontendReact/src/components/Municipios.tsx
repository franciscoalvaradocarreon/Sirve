import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { municipioServicio } from '../api/municipioServicio'
import { procesoServicio } from '../api/procesoServicio'
import type { Municipio, Proceso } from '../types'

/**
 * Catálogo de municipios.
 *
 * Los municipios dependen del proceso: se listan solo los que tienen
 * secciones cargadas en ese proceso. Por eso arriba hay un selector, y no
 * una lista fija.
 */
export function Municipios() {
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [proceso, setProceso] = useState<Proceso | null>(null)
  const [municipios, setMunicipios] = useState<Municipio[]>([])
  const navegar = useNavigate()
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
    municipioServicio
      .listar(proceso.id)
      .then(setMunicipios)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [proceso])

  // Se filtra en el navegador: son 51 filas, no vale la pena ir al servidor.
  const filtrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    if (!t) return municipios
    return municipios.filter(
      (m) => m.nombre.toLowerCase().includes(t) || m.clave.includes(t),
    )
  }, [municipios, busqueda])

  const totalSecciones = useMemo(
    () => filtrados.reduce((suma, m) => suma + m.secciones, 0),
    [filtrados],
  )

  const numero = (n: number) => n.toLocaleString('es-MX')

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-texto">Municipios</h1>
          <p className="mt-1 text-sm text-texto-tenue">
            {numero(filtrados.length)} de {numero(municipios.length)} municipios · {numero(totalSecciones)} secciones
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
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mb-4 relative">
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
              <th className="px-4 py-3 font-medium">Municipio</th>
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
                  {municipios.length === 0
                    ? 'Este proceso no tiene municipios cargados.'
                    : 'Ningún municipio coincide con la búsqueda.'}
                </td>
              </tr>
            )}

            {!cargando &&
              filtrados.map((m) => (
                <tr
                  key={m.id}
                  onClick={() =>
                    navegar(`/catalogos/secciones?id_proceso=${proceso?.id}&id_municipio=${m.id}`)
                  }
                  title="Ver secciones"
                  className="cursor-pointer border-b border-borde transition-colors last:border-0 hover:bg-fondo-alt"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-texto-tenue">{m.clave}</td>
                  <td className="px-4 py-2.5 text-texto">{m.nombre}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-texto-tenue">
                    {m.secciones > 0 ? numero(m.secciones) : '—'}
                  </td>
                </tr>
              ))}
          </tbody>

          {!cargando && filtrados.length > 0 && (
            <tfoot>
              <tr className="border-t border-borde bg-fondo-alt">
                <td colSpan={2} className="px-4 py-2.5 text-xs uppercase tracking-wide text-texto-tenue">
                  Total · {numero(filtrados.length)} {filtrados.length === 1 ? 'municipio' : 'municipios'}
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums text-texto">
                  {numero(totalSecciones)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
