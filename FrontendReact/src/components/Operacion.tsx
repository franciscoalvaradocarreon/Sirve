import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Clock, TriangleAlert } from 'lucide-react'
import { cliente } from '../api/cliente'
import { procesoServicio } from '../api/procesoServicio'
import type { Eleccion, Proceso } from '../types'

interface Resultado {
  etiqueta: string
  votos: number
  porcentaje: number
}

interface Municipio {
  municipio: string
  total: number
  capturadas: number
}

interface Hora {
  hora: string
  capturas: number
}

interface Atrasada {
  municipio: string
  seccion: string
  total: number
  capturadas: number
}

interface Descuadrada {
  municipio: string
  seccion: string
  casilla: string
  total_acta: number
  suma_opciones: number
  diferencia: number
}

interface Operacion {
  eleccion: string
  total: number
  capturadas: number
  avance: number
  conFoto: number
  sinCuadrar: number
  ultima: string | null
  municipios: Municipio[]
  porHora: Hora[]
  atrasadas: Atrasada[]
  descuadradas: Descuadrada[]
  resultados: Resultado[]
  votosTotales: number
}

const REFRESCO_MS = 30_000

/**
 * Tablero de operación.
 *
 * Responde a «¿dónde actuamos?», no a «¿cuánto llevamos?». Por eso lo primero
 * que muestra son las secciones atrasadas y las actas que no cuadran: lo demás
 * es contexto.
 *
 * Se refresca solo cada treinta segundos, igual que la sala.
 */
export function Operacion() {
  const [parametros, setParametros] = useSearchParams()
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [elecciones, setElecciones] = useState<Eleccion[]>([])
  const [datos, setDatos] = useState<Operacion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  const idProceso = Number(parametros.get('id_proceso')) || null
  const idEleccion = Number(parametros.get('id_eleccion')) || null

  const numero = (n?: number) => (n ?? 0).toLocaleString('es-MX')
  const hora = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—'

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
    if (!idEleccion) return
    let vigente = true

    const cargar = async () => {
      try {
        const r = await cliente.get<Operacion>('/reportes/operacion', {
          params: { id_eleccion: idEleccion },
        })
        if (vigente) {
          setDatos(r.data)
          setError(null)
        }
      } catch (e) {
        if (vigente) setError(e instanceof Error ? e.message : 'Sin conexión')
      } finally {
        if (vigente) setCargando(false)
      }
    }

    setCargando(true)
    void cargar()
    const temporizador = window.setInterval(() => void cargar(), REFRESCO_MS)

    return () => {
      vigente = false
      window.clearInterval(temporizador)
    }
  }, [idEleccion])

  const maxHora = useMemo(
    () => Math.max(1, ...(datos?.porHora ?? []).map((h) => h.capturas)),
    [datos],
  )
  const maxVotos = useMemo(
    () => Math.max(1, ...(datos?.resultados ?? []).map((r) => r.porcentaje)),
    [datos],
  )

  const clasesSelect =
    'rounded-lg border border-borde bg-superficie px-3 py-1.5 text-sm text-texto'

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-texto">Operación</h1>
          <p className="mt-1 text-sm text-texto-tenue">
            Cómo va la captura y dónde hace falta empujar.
          </p>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-texto-tenue">
          <Clock size={14} />
          última acta {hora(datos?.ultima)}
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
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {cargando && !datos && <p className="py-6 text-center text-sm text-texto-tenue">Cargando…</p>}

      {datos && (
        <>
          {/* Cifras */}
          <div className="mb-5 grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-borde bg-superficie p-4">
              <p className="text-xs uppercase tracking-wide text-texto-tenue">Avance</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-primario">
                {datos.avance}%
              </p>
              <p className="text-xs text-texto-tenue">
                {numero(datos.capturadas)} de {numero(datos.total)}
              </p>
            </div>
            <div className="rounded-xl border border-borde bg-superficie p-4">
              <p className="text-xs uppercase tracking-wide text-texto-tenue">Actas con foto</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-texto">
                {numero(datos.conFoto)}
              </p>
              <p className="text-xs text-texto-tenue">
                {datos.capturadas > 0
                  ? `${Math.round((datos.conFoto / datos.capturadas) * 100)}% de las capturadas`
                  : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-borde bg-superficie p-4">
              <p className="text-xs uppercase tracking-wide text-texto-tenue">Sin cuadrar</p>
              <p
                className={`mt-1 text-3xl font-semibold tabular-nums ${
                  datos.sinCuadrar > 0 ? 'text-amber-600' : 'text-texto'
                }`}
              >
                {numero(datos.sinCuadrar)}
              </p>
              <p className="text-xs text-texto-tenue">actas cuya suma no cuadra</p>
            </div>
            <div className="rounded-xl border border-borde bg-superficie p-4">
              <p className="text-xs uppercase tracking-wide text-texto-tenue">Votos</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-texto">
                {numero(datos.votosTotales)}
              </p>
              <p className="text-xs text-texto-tenue">capturados</p>
            </div>
          </div>

          {/* Avance */}
          <div className="mb-5 h-3 overflow-hidden rounded-full bg-fondo-alt">
            <div className="h-full rounded-full bg-primario" style={{ width: `${datos.avance}%` }} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Atrasadas */}
            <div className="rounded-xl border border-borde bg-superficie p-4">
              <h2 className="mb-3 text-sm font-semibold text-texto">Secciones con menos avance</h2>
              <table className="w-full text-sm">
                <tbody>
                  {datos.atrasadas.map((a) => (
                    <tr key={`${a.municipio}-${a.seccion}`} className="border-b border-borde-tenue last:border-0">
                      <td className="py-1.5 font-mono text-xs text-texto">{a.seccion}</td>
                      <td className="truncate py-1.5 text-xs text-texto-tenue">{a.municipio}</td>
                      <td className="py-1.5 text-right text-xs tabular-nums text-texto-tenue">
                        {a.capturadas} / {a.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Descuadradas */}
            <div className="rounded-xl border border-borde bg-superficie p-4">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-texto">
                <TriangleAlert size={14} className="text-amber-600" />
                Actas que no cuadran
              </h2>
              {datos.descuadradas.length === 0 ? (
                <p className="text-xs text-texto-tenue">Ninguna. Todas las sumas cuadran.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {datos.descuadradas.map((d) => (
                      <tr key={`${d.seccion}-${d.casilla}`} className="border-b border-borde-tenue last:border-0">
                        <td className="py-1.5 font-mono text-xs text-texto">
                          {d.seccion}-{d.casilla}
                        </td>
                        <td className="truncate py-1.5 text-xs text-texto-tenue">{d.municipio}</td>
                        <td className="py-1.5 text-right text-xs tabular-nums text-amber-600">
                          {d.diferencia > 0 ? '+' : ''}
                          {d.diferencia}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Resultados */}
            <div className="rounded-xl border border-borde bg-superficie p-4">
              <h2 className="mb-3 text-sm font-semibold text-texto">Resultados</h2>
              <div className="space-y-2">
                {datos.resultados.map((r) => (
                  <div key={r.etiqueta} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 truncate text-right text-xs text-texto">
                      {r.etiqueta}
                    </span>
                    <div className="h-5 flex-1 overflow-hidden rounded bg-fondo-alt">
                      <div
                        className="h-full rounded bg-primario"
                        style={{ width: `${Math.max(3, (r.porcentaje / maxVotos) * 100)}%` }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right text-xs tabular-nums text-texto-tenue">
                      {r.porcentaje}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ritmo */}
            <div className="rounded-xl border border-borde bg-superficie p-4">
              <h2 className="mb-3 text-sm font-semibold text-texto">Ritmo de captura</h2>
              <div className="flex h-32 items-end gap-1">
                {datos.porHora.slice(-24).map((h) => (
                  <div
                    key={h.hora}
                    title={`${hora(h.hora)} · ${h.capturas}`}
                    className="flex-1 rounded-t bg-primario"
                    style={{ height: `${Math.max(3, (h.capturas / maxHora) * 100)}%` }}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-texto-tenue">Capturas por hora, últimas 24</p>
            </div>
          </div>

          {/* Municipios */}
          <div className="mt-4 rounded-xl border border-borde bg-superficie p-4">
            <h2 className="mb-3 text-sm font-semibold text-texto">Avance por municipio</h2>
            {/*
              Antes era un mapa de calor: el fondo se teñía según el avance y el
              número iba encima. Con el fondo al 100 % el texto quedaba del mismo
              color que el relleno y no se leía. Ahora es una barra con el número
              al lado: se compara igual de rápido y se lee siempre.
            */}
            <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              {datos.municipios.map((m) => {
                const pct = m.total === 0 ? 0 : Math.round((m.capturadas / m.total) * 100)
                const completo = pct >= 100
                return (
                  <div
                    key={m.municipio}
                    className="flex items-center gap-2 py-0.5"
                    title={`${m.municipio}: ${m.capturadas} de ${m.total} casillas`}
                  >
                    <span className="w-28 shrink-0 truncate text-xs text-texto">
                      {m.municipio}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-fondo-alt">
                      <span
                        className={`block h-full rounded-full ${completo ? 'bg-primario' : 'bg-amber-500'}`}
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </span>
                    <span className="w-11 shrink-0 text-right text-xs tabular-nums text-texto">
                      {pct}%
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
