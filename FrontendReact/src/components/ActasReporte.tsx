import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Image as ImageIcon, Search } from 'lucide-react'
import { cliente } from '../api/cliente'
import { procesoServicio } from '../api/procesoServicio'
import type { Eleccion, Proceso } from '../types'

/** Un acta con foto registrada. */
interface Acta {
  id_casilla: number
  municipio: string
  seccion: string
  casilla: string
  tipo: string
  ruta: string
  bytes: number
  subida_en: string
  capturista: string | null
}

/**
 * Reporte de actas con foto.
 *
 * Arriba, una galería de miniaturas rotuladas con sección y casilla: se hojea
 * como un álbum y se encuentra una sección de un vistazo. Abajo, la banda con
 * el acta elegida en grande y sus datos.
 *
 * Solo lista lo que **ya tiene** acta registrada: es un inventario de lo que
 * existe, no de lo que falta.
 */
export function ActasReporte() {
  const [parametros, setParametros] = useSearchParams()

  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [elecciones, setElecciones] = useState<Eleccion[]>([])
  const [filas, setFilas] = useState<Acta[]>([])
  const [elegida, setElegida] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const idProceso = Number(parametros.get('id_proceso')) || null
  const idEleccion = Number(parametros.get('id_eleccion')) || null

  const numero = (n: number) => n.toLocaleString('es-MX')

  /**
   * Rótulo «sección-casilla».
   *
   * Se toma el tipo del servidor; si no viniera —un backend anterior a este
   * cambio— se saca de la clave completa, que termina en el tipo: …-1474-B.
   */
  const rotulo = (a: Acta) => `${a.seccion}-${a.tipo ?? a.casilla.split('-').pop()}`
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
      .then((r) => {
        setFilas(r.data)
        setElegida(r.data.length > 0 ? r.data[0].id_casilla : null)
      })
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
        f.casilla.toLowerCase().includes(t) ||
        (f.capturista ?? '').toLowerCase().includes(t),
    )
  }, [filas, busqueda])

  const acta = filtradas.find((f) => f.id_casilla === elegida) ?? null
  const indice = acta ? filtradas.findIndex((f) => f.id_casilla === acta.id_casilla) : -1

  const mover = (salto: number) => {
    if (filtradas.length === 0) return
    const siguiente = (indice + salto + filtradas.length) % filtradas.length
    setElegida(filtradas[siguiente].id_casilla)
  }

  // Flechas del teclado para recorrer la galería sin usar el ratón.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') mover(1)
      if (e.key === 'ArrowLeft') mover(-1)
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice, filtradas])

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
    <div className="mx-auto max-w-6xl">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-texto">Actas</h1>
        <p className="mt-1 text-sm text-texto-tenue">
          {numero(totales.actas)} casillas con foto · {peso(totales.bytes)}
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

      {cargando && <p className="py-6 text-center text-sm text-texto-tenue">Cargando…</p>}

      {!cargando && filtradas.length === 0 && (
        <div className="rounded-xl border border-borde bg-superficie p-10 text-center text-texto-tenue">
          <ImageIcon size={22} className="mx-auto mb-2 opacity-40" />
          Todavía no hay actas con foto en esta elección.
        </div>
      )}

      {/* Galería de miniaturas */}
      {filtradas.length > 0 && (
        <div className="mb-4 grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
          {filtradas.map((a) => {
            const activa = a.id_casilla === elegida
            return (
              <button
                key={a.id_casilla}
                onClick={() => setElegida(a.id_casilla)}
                title={`${a.seccion}-${a.casilla} · ${a.municipio}`}
                className={`overflow-hidden rounded-lg border text-left transition-colors ${
                  activa
                    ? 'border-primario ring-2 ring-primario/30'
                    : 'border-borde hover:border-primario/60'
                }`}
              >
                <img
                  src={`/api/actas/${a.id_casilla}/${idEleccion}/imagen`}
                  alt={`Acta ${a.seccion}-${a.casilla}`}
                  loading="lazy"
                  className="aspect-[4/3] w-full bg-fondo-alt object-cover"
                />
                <span
                  className={`block truncate px-1.5 py-1 text-[11px] font-medium ${
                    activa ? 'bg-primario/10 text-primario' : 'bg-superficie text-texto'
                  }`}
                >
                  {rotulo(a)}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Banda con el acta elegida */}
      {acta && (
        <div className="rounded-xl border border-borde bg-superficie">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde px-4 py-2.5">
            <p className="text-[1.75rem] font-medium leading-tight text-texto">
              Sec. {rotulo(acta)}
              <span className="ml-3 text-[1.5rem] font-normal text-texto-tenue">
                {acta.municipio}
                {acta.capturista ? ` · ${acta.capturista}` : ''}
                {` · ${peso(acta.bytes)}`}
              </span>
            </p>

            <span className="flex items-center gap-1">
              <span className="mr-2 text-xs text-texto-tenue">
                {indice + 1} de {filtradas.length}
              </span>
              <button
                onClick={() => mover(-1)}
                className="rounded-lg border border-borde p-1.5 text-texto-tenue hover:text-primario"
                title="Anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => mover(1)}
                className="rounded-lg border border-borde p-1.5 text-texto-tenue hover:text-primario"
                title="Siguiente"
              >
                <ChevronRight size={16} />
              </button>
              <a
                href={`/api/actas/${acta.id_casilla}/${idEleccion}/imagen`}
                target="_blank"
                rel="noreferrer"
                className="ml-2 text-xs text-primario hover:underline"
              >
                Ver completa
              </a>
            </span>
          </div>

          <div className="flex items-center justify-center bg-fondo-alt p-3">
            <img
              src={`/api/actas/${acta.id_casilla}/${idEleccion}/imagen`}
              alt={`Acta ${acta.seccion}-${acta.casilla}`}
              className="max-h-[60vh] rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}
