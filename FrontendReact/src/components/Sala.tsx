import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Clock, Image as ImageIcon } from 'lucide-react'
import { cliente } from '../api/cliente'

interface Resultado {
  etiqueta: string
  color: string
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

interface Eleccion {
  id: number
  nombre: string
  tipo: string
  alcance: 'ESTADO' | 'DISTRITO_LOCAL' | 'DISTRITO_FEDERAL' | 'MUNICIPIO'
}

interface Opcion {
  id: number
  nombre: string
  clave?: string
}

interface Sala {
  habilitada: boolean
  servidor: string
  mensaje?: string
  eleccion?: string
  alcance?: string
  total?: number
  capturadas?: number
  avance?: number
  conFoto?: number
  ultima?: string | null
  resultados?: Resultado[]
  votosTotales?: number
  municipios?: Municipio[]
  porHora?: Hora[]
}

const REFRESCO_MS = 30_000

/** Nombre corto para las pestañas, que deben caber en una línea. */
function etiquetaCorta(nombre: string): string {
  return nombre
    .replace(/\s*\d{4}\s*$/, '')
    .replace('Diputaciones locales', 'Dip. locales')
    .replace('Diputaciones federales', 'Dip. federales')
    .replace('Ayuntamientos', 'Ayuntamientos')
}

/**
 * Sala de resultados: la pantalla pública.
 *
 * Pensada para verse de lejos, en una pantalla en una sala: números grandes,
 * pocos elementos y ninguna interacción que estorbe. Se refresca sola cada
 * treinta segundos.
 *
 * Cada elección se mira a su escala. Gobernatura es de todo el estado; las
 * diputaciones, por distrito; los ayuntamientos, por municipio. Por eso hay una
 * pestaña por elección y, cuando la elección no es estatal, un combo para
 * elegir el distrito o el municipio.
 *
 * Solo muestra agregados: ni nombres, ni actas, ni resultados por casilla.
 */
export function Sala() {
  const [parametros, setParametros] = useSearchParams()
  const [datos, setDatos] = useState<Sala | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elecciones, setElecciones] = useState<Eleccion[]>([])
  const [opciones, setOpciones] = useState<Opcion[]>([])
  const [alcance, setAlcance] = useState<string>('ESTADO')

  const idEleccion = Number(parametros.get('id_eleccion')) || null
  const idAmbito = Number(parametros.get('id_ambito')) || null

  const numero = (n?: number) => (n ?? 0).toLocaleString('es-MX')
  const hora = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
      : '—'

  const cambiar = (clave: string, valor: string | null) => {
    setParametros(
      (prev) => {
        if (valor) prev.set(clave, valor)
        else prev.delete(clave)
        return prev
      },
      { replace: true },
    )
  }

  // 1) Las elecciones, para las pestañas. Se elige la primera si no viene ninguna.
  useEffect(() => {
    cliente
      .get<Eleccion[]>('/publico/sala/elecciones')
      .then((r) => {
        setElecciones(r.data)
        if (!idEleccion && r.data.length > 0) cambiar('id_eleccion', String(r.data[0].id))
      })
      .catch(() => {
        // Sin lista no hay pestañas, pero la sala sigue funcionando.
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 2) Al cambiar de elección, se piden sus distritos o municipios.
  useEffect(() => {
    if (!idEleccion) return
    cliente
      .get<{ alcance: string; opciones: Opcion[] }>('/publico/sala/opciones', {
        params: { id_eleccion: idEleccion },
      })
      .then((r) => {
        setAlcance(r.data.alcance)
        setOpciones(r.data.opciones ?? [])
      })
      .catch(() => {
        setAlcance('ESTADO')
        setOpciones([])
      })
  }, [idEleccion])

  // 3) Los datos, refrescándose solos.
  useEffect(() => {
    let vigente = true

    const cargar = async () => {
      if (!idEleccion) {
        setError('Falta indicar la elección en la dirección.')
        return
      }
      try {
        const r = await cliente.get<Sala>('/publico/sala', {
          params: { id_eleccion: idEleccion, id_ambito: idAmbito ?? undefined },
        })
        if (vigente) {
          setDatos(r.data)
          setError(null)
        }
      } catch (e) {
        if (vigente) setError(e instanceof Error ? e.message : 'Sin conexión')
      }
    }

    void cargar()
    const temporizador = window.setInterval(() => void cargar(), REFRESCO_MS)

    return () => {
      vigente = false
      window.clearInterval(temporizador)
    }
  }, [idEleccion, idAmbito])

  // Sin datos todavía: la pantalla debe decirlo, no mostrar ceros que parezcan
  // un conteo real.
  if (error || (datos && !datos.habilitada)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-fondo px-6">
        <div className="max-w-lg text-center">
          <p className="text-4xl font-semibold text-texto">Resultados</p>
          <p className="mt-4 text-lg text-texto-tenue">
            {datos && !datos.habilitada
              ? (datos.mensaje ?? 'Los resultados se publicarán el día de la jornada.')
              : error}
          </p>
        </div>
      </div>
    )
  }

  if (!datos) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-fondo">
        <p className="text-texto-tenue">Cargando…</p>
      </div>
    )
  }

  const sinCapturas = (datos.capturadas ?? 0) === 0
  const maxVotos = Math.max(1, ...(datos.resultados ?? []).map((r) => r.porcentaje))
  const maxHora = Math.max(1, ...(datos.porHora ?? []).map((h) => h.capturas))
  const porPartes = alcance !== 'ESTADO' && opciones.length > 0

  return (
    <div className="min-h-screen bg-fondo px-6 py-4">
      <div className="mx-auto max-w-6xl">
        {/* Pestañas: una por elección. Sustituyen al combo, para que se vea de
            lejos cuál está puesta y se cambie de un toque. */}
        <nav className="mb-3 flex flex-wrap gap-1 border-b border-borde">
          {elecciones.map((e) => {
            const activa = e.id === idEleccion
            return (
              <button
                key={e.id}
                onClick={() => {
                  setParametros({ id_eleccion: String(e.id) }, { replace: true })
                }}
                className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  activa
                    ? 'border-primario text-primario'
                    : 'border-transparent text-texto-tenue hover:text-texto'
                }`}
              >
                {etiquetaCorta(e.nombre)}
              </button>
            )
          })}
        </nav>

        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-borde pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold text-texto">{datos.eleccion}</h1>

            {/* Solo para elecciones que se miran por partes. */}
            {porPartes && (
              <select
                value={idAmbito ?? ''}
                onChange={(e) => cambiar('id_ambito', e.target.value || null)}
                className="rounded-lg border border-borde bg-superficie px-3 py-1.5 text-sm text-texto"
                title={alcance === 'MUNICIPIO' ? 'Cambiar de municipio' : 'Cambiar de distrito'}
              >
                <option value="">
                  {alcance === 'MUNICIPIO' ? 'Todos los municipios' : 'Todos los distritos'}
                </option>
                {opciones.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.clave ? `${o.clave} · ${o.nombre}` : o.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>

          <p className="flex items-center gap-1.5 text-sm text-texto-tenue">
            <Clock size={14} />
            última acta {hora(datos.ultima)}
          </p>
        </header>

        {sinCapturas ? (
          <div className="rounded-2xl border border-borde bg-superficie p-16 text-center">
            <p className="text-2xl font-medium text-texto">Esperando el primer acta</p>
            <p className="mt-2 text-texto-tenue">
              La sala se actualiza sola. En cuanto llegue una captura, aparecerá aquí.
            </p>
          </div>
        ) : (
          <>
            {/* Cifras grandes */}
            <div className="mb-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-borde bg-superficie p-6 text-center">
                <p className="text-6xl font-bold tabular-nums text-primario">{datos.avance}%</p>
                <p className="mt-1 text-sm uppercase tracking-wide text-texto-tenue">capturado</p>
              </div>
              <div className="rounded-2xl border border-borde bg-superficie p-6 text-center">
                <p className="text-6xl font-bold tabular-nums text-texto">
                  {numero(datos.capturadas)}
                </p>
                <p className="mt-1 text-sm uppercase tracking-wide text-texto-tenue">
                  de {numero(datos.total)} casillas
                </p>
              </div>
              <div className="rounded-2xl border border-borde bg-superficie p-6 text-center">
                <p className="flex items-center justify-center gap-2 text-6xl font-bold tabular-nums text-texto">
                  <ImageIcon size={36} className="text-texto-tenue" />
                  {numero(datos.conFoto)}
                </p>
                <p className="mt-1 text-sm uppercase tracking-wide text-texto-tenue">
                  actas con foto
                </p>
              </div>
            </div>

            <div className="mb-5 h-3 overflow-hidden rounded-full bg-fondo-alt">
              <div
                className="h-full rounded-full bg-primario transition-all duration-700"
                style={{ width: `${datos.avance ?? 0}%` }}
              />
            </div>

            {/* Resultados */}
            <div className="mb-4 rounded-2xl border border-borde bg-superficie p-6">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="text-lg font-semibold text-texto">Resultados</h2>
                <p className="text-sm text-texto-tenue">
                  {numero(datos.votosTotales)} votos capturados
                </p>
              </div>

              <div className="space-y-3">
                {(datos.resultados ?? []).map((r) => (
                  <div key={r.etiqueta} className="flex items-center gap-4">
                    <span className="flex w-28 shrink-0 items-center justify-end gap-1.5">
                      {/* El color del partido, como en la boleta. */}
                      <span
                        className="h-3 w-3 shrink-0 rounded-sm"
                        style={{ background: r.color }}
                        aria-hidden
                      />
                      <span className="truncate text-sm font-medium text-texto">{r.etiqueta}</span>
                    </span>
                    <div className="h-8 flex-1 overflow-hidden rounded-md bg-fondo-alt">
                      <div
                        className="flex h-full items-center justify-end rounded-md pr-2 transition-all duration-700"
                        style={{
                          width: `${Math.max(4, (r.porcentaje / maxVotos) * 100)}%`,
                          background: r.color,
                        }}
                      >
                        <span className="text-xs font-semibold text-white">{r.porcentaje}%</span>
                      </div>
                    </div>
                    <span className="w-20 shrink-0 text-right tabular-nums text-sm text-texto-tenue">
                      {numero(r.votos)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ritmo y municipios */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-borde bg-superficie p-6">
                <h2 className="mb-3 text-lg font-semibold text-texto">Ritmo de captura</h2>
                <div className="flex h-32 items-end gap-1">
                  {(datos.porHora ?? []).slice(-24).map((h) => (
                    <div
                      key={h.hora}
                      title={`${hora(h.hora)} · ${h.capturas}`}
                      className="flex-1 rounded-t bg-primario"
                      style={{ height: `${Math.max(3, (h.capturas / maxHora) * 100)}%` }}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-texto-tenue">Capturas por hora</p>
              </div>

              <div className="rounded-2xl border border-borde bg-superficie p-6">
                <h2 className="mb-3 text-lg font-semibold text-texto">Avance por municipio</h2>
                {/* Barra con el número al lado: el fondo teñido dejaba el texto
                    del mismo color que el relleno y no se leía. */}
                <div className="grid max-h-40 grid-cols-1 gap-x-4 gap-y-1 overflow-y-auto text-xs sm:grid-cols-2">
                  {(datos.municipios ?? []).map((m) => {
                    const pct = m.total === 0 ? 0 : Math.round((m.capturadas / m.total) * 100)
                    return (
                      <div
                        key={m.municipio}
                        className="flex items-center gap-2 py-0.5"
                        title={`${m.municipio}: ${m.capturadas} de ${m.total} casillas`}
                      >
                        <span className="w-24 shrink-0 truncate text-texto">{m.municipio}</span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-fondo-alt">
                          <span
                            className="block h-full rounded-full bg-primario"
                            style={{ width: `${Math.max(2, pct)}%` }}
                          />
                        </span>
                        <span className="w-9 shrink-0 text-right tabular-nums text-texto">
                          {pct}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <p className="mt-5 text-center text-xs text-texto-tenue">
              Se actualiza cada 30 segundos · última acta {hora(datos.ultima)}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
