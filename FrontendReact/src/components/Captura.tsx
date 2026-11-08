import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, RotateCcw, Save } from 'lucide-react'
import { casillaServicio } from '../api/casillaServicio'
import { capturaServicio } from '../api/capturaServicio'
import { eleccionServicio } from '../api/eleccionServicio'
import { municipioServicio } from '../api/municipioServicio'
import { procesoServicio } from '../api/procesoServicio'
import { seccionServicio } from '../api/seccionServicio'
import type { Casilla, Captura, Eleccion, Municipio, OpcionBoleta, Proceso, Seccion } from '../types'

/**
 * Captura de resultados por casilla.
 *
 * La pantalla ocupa el alto completo y no hace scroll de página: la boleta
 * es lo único que se desplaza, por dentro de su tarjeta. Así el total, la
 * comprobación y el botón de guardar quedan siempre a la vista mientras se
 * capturan los 25 renglones.
 *
 * Enter avanza al siguiente campo, para capturar sin levantar la vista.
 */
export function Captura() {
  const [parametros, setParametros] = useSearchParams()

  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [elecciones, setElecciones] = useState<Eleccion[]>([])
  const [municipios, setMunicipios] = useState<Municipio[]>([])
  const [secciones, setSecciones] = useState<Seccion[]>([])
  const [casillas, setCasillas] = useState<Casilla[]>([])
  const [opciones, setOpciones] = useState<OpcionBoleta[]>([])

  const [votos, setVotos] = useState<Record<number, string>>({})
  const [totalActa, setTotalActa] = useState('')
  const [nulos, setNulos] = useState('')
  const [noRegistrados, setNoRegistrados] = useState('')

  const [capturaPrevia, setCapturaPrevia] = useState<Captura | null>(null)
  const [guardada, setGuardada] = useState<Captura | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const idProceso = Number(parametros.get('id_proceso')) || null
  const idEleccion = Number(parametros.get('id_eleccion')) || null
  const idMunicipio = Number(parametros.get('id_municipio')) || null
  const claveSeccion = parametros.get('seccion') ?? ''
  const idCasilla = Number(parametros.get('id_casilla')) || null

  const casilla = casillas.find((c) => c.id === idCasilla) ?? null

  const numero = (n: number) => n.toLocaleString('es-MX')

  // Referencias para la navegación con Enter
  const refsVotos = useRef<(HTMLInputElement | null)[]>([])
  const refTotal = useRef<HTMLInputElement | null>(null)
  const refNoReg = useRef<HTMLInputElement | null>(null)
  const refNulos = useRef<HTMLInputElement | null>(null)
  const refGuardar = useRef<HTMLButtonElement | null>(null)

  /* ------------------------------ catálogos ------------------------------ */

  useEffect(() => {
    procesoServicio
      .listar()
      .then((datos) => {
        setProcesos(datos)
        if (!idProceso) {
          const activo = datos.find((p) => p.activo) ?? datos[0]
          if (activo) {
            setParametros((prev) => {
              prev.set('id_proceso', String(activo.id))
              return prev
            }, { replace: true })
          }
        }
      })
      .catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!idProceso) return
    procesoServicio
      .elecciones(idProceso)
      .then((es) => {
        setElecciones(es)
        if (!idEleccion && es[0]) {
          setParametros((prev) => {
            prev.set('id_eleccion', String(es[0].id))
            return prev
          }, { replace: true })
        }
      })
      .catch((e) => setError(e.message))
  }, [idProceso, idEleccion, setParametros])

  useEffect(() => {
    if (!idProceso) return
    municipioServicio.listar(idProceso).then(setMunicipios).catch((e) => setError(e.message))
  }, [idProceso])

  useEffect(() => {
    if (!idProceso || !idMunicipio) {
      setSecciones([])
      return
    }
    seccionServicio.listar(idMunicipio, idProceso).then(setSecciones).catch((e) => setError(e.message))
  }, [idProceso, idMunicipio])

  useEffect(() => {
    if (!idEleccion || !claveSeccion || !idMunicipio) {
      setCasillas([])
      return
    }
    casillaServicio
      .listar(idEleccion, { seccion: claveSeccion, idMunicipio })
      .then((cs) => {
        setCasillas(cs)
        // Al elegir sección se preselecciona la primera casilla: casi siempre
        // se captura la básica, y así no hay un paso de más.
        const actual = Number(parametros.get('id_casilla')) || null
        if (cs.length > 0 && !cs.some((c) => c.id === actual)) {
          setParametros((prev) => {
            prev.set('id_casilla', String(cs[0].id))
            return prev
          })
        }
      })
      .catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idEleccion, claveSeccion, idMunicipio])

  useEffect(() => {
    if (!idEleccion) {
      setOpciones([])
      return
    }
    eleccionServicio.opciones(idEleccion).then(setOpciones).catch((e) => setError(e.message))
  }, [idEleccion])

  /* --------------------------- captura existente -------------------------- */

  useEffect(() => {
    setGuardada(null)
    setCapturaPrevia(null)
    if (!idCasilla || !idEleccion) {
      setVotos({})
      setTotalActa('')
      setNulos('')
      setNoRegistrados('')
      return
    }

    let vigente = true
    capturaServicio
      .consultar(idCasilla, idEleccion)
      .then(async (c) => {
        if (!vigente) return
        setCapturaPrevia(c)
        const detalle = await capturaServicio.votos(idCasilla, idEleccion)
        const mapa: Record<number, string> = {}
        detalle.forEach((v) => {
          mapa[v.id_opcion] = String(v.votos)
        })
        setVotos(mapa)
        setTotalActa(String(c.total_acta))
        setNulos(String(c.nulos))
        setNoRegistrados(String(c.no_registrados))
      })
      .catch(() => {
        if (!vigente) return
        setCapturaPrevia(null)
        setVotos({})
        setTotalActa('')
        setNulos('')
        setNoRegistrados('')
      })

    return () => {
      vigente = false
    }
  }, [idCasilla, idEleccion])

  /* ------------------------------ aritmética ----------------------------- */

  const entero = (v: string) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0
  }

  const suma = useMemo(
    () => Object.values(votos).reduce((t, v) => t + entero(v), 0),
    [votos],
  )

  const total = entero(totalActa)
  const nulosNum = entero(nulos)
  const noRegNum = entero(noRegistrados)
  const diferencia = total - (suma + noRegNum + nulosNum)
  const cuadra = total > 0 && diferencia === 0

  /* ------------------------------ navegación ----------------------------- */

  /** Enter pasa al siguiente campo; en el último renglón, al total del acta. */
  const alPresionarEnter = (evento: React.KeyboardEvent<HTMLInputElement>, indice: number) => {
    if (evento.key !== 'Enter') return
    evento.preventDefault()
    const siguiente = refsVotos.current[indice + 1]
    if (siguiente) siguiente.focus()
    else refNoReg.current?.focus()
  }

  const cambiarParametro = (clave: string, valor: string | null, limpiar: string[] = []) => {
    setParametros((prev) => {
      if (valor) prev.set(clave, valor)
      else prev.delete(clave)
      limpiar.forEach((k) => prev.delete(k))
      return prev
    })
  }

  const reiniciar = () => {
    const mapa: Record<number, string> = {}
    opciones.forEach((o) => {
      mapa[o.id] = ''
    })
    setVotos(mapa)
    setTotalActa('')
    setNulos('')
    setNoRegistrados('')
    setGuardada(null)
  }

  async function guardar() {
    if (!casilla || !idEleccion) return
    setError(null)
    setGuardando(true)
    try {
      const resultado = await capturaServicio.guardar({
        id_cliente: crypto.randomUUID(),
        id_casilla: casilla.id,
        id_eleccion: idEleccion,
        total_acta: total,
        no_registrados: noRegNum,
        nulos: nulosNum,
        votos: opciones
          .map((o) => ({ id_opcion: o.id, votos: entero(votos[o.id] ?? '') }))
          .filter((v) => v.votos > 0),
        autor_texto: null,
      })
      setGuardada(resultado)
      setCapturaPrevia(resultado)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la captura')
    } finally {
      setGuardando(false)
    }
  }

  const clasesSelect =
    'rounded-lg border border-borde bg-superficie px-2.5 py-1.5 text-sm text-texto disabled:opacity-50'

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Encabezado con el proceso, igual que los catálogos */}
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-texto">Capturar casilla</h1>
          <p className="mt-0.5 text-sm text-texto-tenue">
            {casilla
              ? `${casilla.clave} · ${casilla.municipio}`
              : 'Elige la casilla y captura los votos tal como vienen en el acta.'}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex items-center gap-2 text-sm text-texto-tenue">
            Proceso
            <select
              value={idProceso ?? ''}
              onChange={(e) =>
                cambiarParametro('id_proceso', e.target.value, [
                  'id_eleccion', 'id_municipio', 'seccion', 'id_casilla',
                ])
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
              onChange={(e) => cambiarParametro('id_eleccion', e.target.value, ['id_casilla'])}
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
        <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Selección de la casilla */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-borde bg-superficie px-3 py-2">
        <label className="flex items-center gap-1.5 text-sm text-texto-tenue">
          Municipio
          <select
            value={idMunicipio ?? ''}
            onChange={(e) => cambiarParametro('id_municipio', e.target.value, ['seccion', 'id_casilla'])}
            className={clasesSelect}
          >
            <option value="">—</option>
            {municipios.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-sm text-texto-tenue">
          Sección
          <select
            value={claveSeccion}
            onChange={(e) => cambiarParametro('seccion', e.target.value, ['id_casilla'])}
            className={clasesSelect}
            disabled={secciones.length === 0}
          >
            <option value="">—</option>
            {secciones.map((s) => (
              <option key={s.id} value={s.clave}>
                {s.clave}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-sm text-texto-tenue">
          Casilla
          <select
            value={idCasilla ?? ''}
            onChange={(e) => cambiarParametro('id_casilla', e.target.value)}
            className={clasesSelect}
            disabled={casillas.length === 0}
          >
            <option value="">—</option>
            {casillas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.tipo}
                {c.capturada ? ' · capturada' : ''}
              </option>
            ))}
          </select>
        </label>

        {capturaPrevia && (
          <span className="ml-auto rounded-full bg-primario-suave px-2.5 py-1 text-xs font-medium text-primario-texto">
            Ya tiene captura · se reemplazará
          </span>
        )}
      </div>

      {!casilla ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-borde bg-superficie text-sm text-texto-tenue">
          Elige municipio, sección y casilla para empezar.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:items-start">
          {/* Boleta: lo único que se desplaza */}
          <div className="flex flex-col overflow-hidden rounded-xl border border-borde bg-superficie">
            <div className="flex items-center justify-between border-b border-borde px-3 py-2">
              <span className="text-xs font-medium uppercase tracking-wide text-texto-tenue">
                Boleta · {opciones.length} opciones
              </span>
              <span className="text-xs text-texto-tenue">Enter pasa al siguiente</span>
            </div>

            {/* Dos columnas: con 17 a 25 opciones, en pares caben todas sin
                desplazar la lista. El orden de tabulación sigue siendo el del
                acta: izquierda a derecha, renglón por renglón. */}
            <div className="grid grid-cols-1 gap-x-4 gap-y-1 p-3 sm:grid-cols-2">
              {opciones.map((o, i) => (
                <div
                  key={o.id}
                  className="flex items-center gap-2 rounded-lg px-1 py-0.5 focus-within:bg-fondo-alt"
                >
                  <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-texto-tenue">
                    {i + 1}
                  </span>
                  <label
                    htmlFor={`voto-${o.id}`}
                    title={`${o.etiqueta} · ${o.tipo}`}
                    className="min-w-0 flex-1 truncate text-sm text-texto"
                  >
                    {o.etiqueta}
                    <span className="ml-1.5 text-[10px] uppercase text-texto-tenue">{o.tipo}</span>
                  </label>
                  <input
                    id={`voto-${o.id}`}
                    ref={(el) => {
                      refsVotos.current[i] = el
                    }}
                    value={votos[o.id] ?? ''}
                    onChange={(e) =>
                      setVotos((prev) => ({ ...prev, [o.id]: e.target.value.replace(/\D/g, '') }))
                    }
                    onKeyDown={(e) => alPresionarEnter(e, i)}
                    inputMode="numeric"
                    placeholder="0"
                    className="w-20 shrink-0 rounded-md border border-borde bg-fondo px-2 py-1 text-right text-sm tabular-nums text-texto focus:border-primario focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Panel de totales, siempre visible */}
          <aside className="flex w-full shrink-0 flex-col gap-2 lg:w-64">
            <div className="rounded-xl border border-borde bg-superficie p-3">
              {/* Orden de captura: no registrados, nulos y al final el total
                  del acta, que es la cifra de cierre del acta. */}
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-texto-tenue">
                  No reg.
                  <input
                    ref={refNoReg}
                    value={noRegistrados}
                    onChange={(e) => setNoRegistrados(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        refNulos.current?.focus()
                      }
                    }}
                    inputMode="numeric"
                    placeholder="0"
                    className="mt-1 w-full rounded-lg border border-borde bg-fondo px-2 py-1 text-right tabular-nums text-texto focus:border-primario focus:outline-none"
                  />
                </label>
                <label className="block text-xs text-texto-tenue">
                  Nulos
                  <input
                    ref={refNulos}
                    value={nulos}
                    onChange={(e) => setNulos(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        refTotal.current?.focus()
                      }
                    }}
                    inputMode="numeric"
                    placeholder="0"
                    className="mt-1 w-full rounded-lg border border-borde bg-fondo px-2 py-1 text-right tabular-nums text-texto focus:border-primario focus:outline-none"
                  />
                </label>
              </div>

              <label className="mt-2 block text-xs text-texto-tenue">
                Total del acta
                <input
                  ref={refTotal}
                  value={totalActa}
                  onChange={(e) => setTotalActa(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      refGuardar.current?.focus()
                    }
                  }}
                  inputMode="numeric"
                  placeholder="0"
                  className="mt-1 w-full rounded-lg border border-borde bg-fondo px-2 py-1.5 text-right text-lg tabular-nums text-texto focus:border-primario focus:outline-none"
                />
              </label>
            </div>

            {/* Comprobación */}
            <div
              className={[
                'rounded-xl border p-3 text-sm',
                cuadra
                  ? 'border-primario-borde bg-primario-suave text-primario-texto'
                  : 'border-borde bg-superficie text-texto',
              ].join(' ')}
            >
              <div className="flex items-center justify-between text-xs">
                <span>Suma de opciones</span>
                <strong className="tabular-nums">{numero(suma)}</strong>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span>Suma + NR + nulos</span>
                <strong className="tabular-nums">{numero(suma + noRegNum + nulosNum)}</strong>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span>Total del acta</span>
                <strong className="tabular-nums">{numero(total)}</strong>
              </div>
              <div className="mt-2 flex items-center gap-1.5 border-t border-current/20 pt-2 text-sm font-medium">
                {cuadra ? (
                  <>
                    <Check size={15} /> Cuadra
                  </>
                ) : (
                  <>Diferencia: {numero(diferencia)}</>
                )}
              </div>
            </div>

            <div className="mt-auto flex flex-col gap-2">
              <button
                ref={refGuardar}
                onClick={guardar}
                disabled={guardando || total <= 0 || opciones.length === 0}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-primario px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Save size={15} />
                {guardando ? 'Guardando…' : 'Guardar captura'}
              </button>

              <button
                onClick={reiniciar}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-borde px-3 py-1.5 text-sm text-texto-tenue transition-colors hover:text-texto"
              >
                <RotateCcw size={14} />
                Limpiar
              </button>
            </div>

            {guardada && (
              <div className="rounded-lg border border-primario-borde bg-primario-suave p-2 text-xs text-primario-texto">
                Guardada · suma {numero(guardada.suma_opciones)}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
