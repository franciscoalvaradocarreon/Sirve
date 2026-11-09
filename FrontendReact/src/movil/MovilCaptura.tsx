import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CloudOff, Save, TriangleAlert } from 'lucide-react'
import { ErrorApi } from '../api/cliente'
import { capturaServicio } from '../api/capturaServicio'
import { casillaServicio } from '../api/casillaServicio'
import { eleccionServicio } from '../api/eleccionServicio'
import { municipioServicio } from '../api/municipioServicio'
import { procesoServicio } from '../api/procesoServicio'
import { seccionServicio } from '../api/seccionServicio'
import { cola } from '../utils/cola'
import { useProceso } from './ProcesoContext'
import { AvisoFlotante } from './AvisoFlotante'
import { conCache } from '../utils/cache'
import { nuevoUuid } from '../utils/uuid'
import type {
  Casilla,
  Eleccion,
  Municipio,
  OpcionBoleta,
  Proceso,
  Seccion,
} from '../types'

/**
 * Captura en el teléfono.
 *
 * Es una pantalla aparte de la de escritorio, no la misma adaptada: aquí todo
 * va en una columna, los campos son grandes y el resumen queda fijo abajo.
 *
 * Funciona sin conexión. Los catálogos se guardan al consultarlos y las
 * capturas que no se pueden enviar se encolan en el teléfono con su
 * identificador de cliente, así que reenviarlas después no duplica nada.
 */
export function MovilCaptura() {
  const [parametros, setParametros] = useSearchParams()

  const [enLinea, setEnLinea] = useState(navigator.onLine)
  const { setProceso } = useProceso()

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

  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<
    { tipo: 'ok' | 'cola' | 'error'; texto: string } | null
  >(null)

  const idProceso = Number(parametros.get('id_proceso')) || null
  const idEleccion = Number(parametros.get('id_eleccion')) || null
  const idMunicipio = Number(parametros.get('id_municipio')) || null
  const claveSeccion = parametros.get('seccion') ?? ''
  const idCasilla = Number(parametros.get('id_casilla')) || null

  const proceso = procesos.find((p) => p.id === idProceso) ?? null

  // La barra superior muestra el proceso; esta pantalla es quien lo conoce.
  useEffect(() => {
    setProceso(proceso)
  }, [proceso, setProceso])
  const casilla = casillas.find((c) => c.id === idCasilla) ?? null
  const eleccion = elecciones.find((e) => e.id === idEleccion) ?? null

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

  /* ------------------------------ catálogos ------------------------------ */

  useEffect(() => {
    conCache('procesos', () => procesoServicio.listar())
      .then((datos) => {
        setProcesos(datos)
        if (!idProceso && datos.length > 0) {
          const activo = datos.find((p) => p.activo) ?? datos[0]
          cambiar('id_proceso', String(activo.id))
        }
      })
      .catch(() => setAviso({ tipo: 'error', texto: 'Sin datos guardados de procesos.' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!idProceso) return
    conCache(`elecciones:${idProceso}`, () => procesoServicio.elecciones(idProceso))
      .then((datos) => {
        setElecciones(datos)
        if (!idEleccion && datos.length > 0) cambiar('id_eleccion', String(datos[0].id))
      })
      .catch(() => setAviso({ tipo: 'error', texto: 'Sin datos guardados de elecciones.' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idProceso])

  useEffect(() => {
    if (!idProceso) return
    conCache(`municipios:${idProceso}`, () => municipioServicio.listar(idProceso))
      .then(setMunicipios)
      .catch(() => setAviso({ tipo: 'error', texto: 'Sin datos guardados de municipios.' }))
  }, [idProceso])

  useEffect(() => {
    if (!idProceso || !idMunicipio) {
      setSecciones([])
      return
    }
    conCache(`secciones:${idProceso}:${idMunicipio}`, () =>
      seccionServicio.listar(idMunicipio, idProceso),
    )
      .then(setSecciones)
      .catch(() => setSecciones([]))
  }, [idProceso, idMunicipio])

  useEffect(() => {
    if (!idEleccion || !claveSeccion) {
      setCasillas([])
      return
    }
    conCache(`casillas:${idEleccion}:${claveSeccion}`, () =>
      casillaServicio.listar(idEleccion, { seccion: claveSeccion, idMunicipio: idMunicipio ?? undefined }),
    )
      .then((cs) => {
        setCasillas(cs)
        if (cs.length > 0 && !cs.some((c) => c.id === idCasilla)) {
          cambiar('id_casilla', String(cs[0].id))
        }
      })
      .catch(() => setCasillas([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idEleccion, claveSeccion, idMunicipio])

  useEffect(() => {
    if (!idEleccion) {
      setOpciones([])
      return
    }
    conCache(`opciones:${idEleccion}`, () => eleccionServicio.opciones(idEleccion))
      .then(setOpciones)
      .catch(() => setOpciones([]))
  }, [idEleccion])

  /* --------------------------- captura existente -------------------------- */

  useEffect(() => {
    setVotos({})
    setTotalActa('')
    setNulos('')
    setNoRegistrados('')
    setAviso(null)
    if (!idCasilla || !idEleccion) return

    let vigente = true
    capturaServicio
      .consultar(idCasilla, idEleccion)
      .then(async (c) => {
        if (!vigente) return
        const detalle = await capturaServicio.votos(idCasilla, idEleccion)
        const mapa: Record<number, string> = {}
        detalle.forEach((v) => {
          mapa[v.id_opcion] = String(v.votos)
        })
        setVotos(mapa)
        setTotalActa(String(c.total_acta))
        setNulos(String(c.nulos))
        setNoRegistrados(String(c.no_registrados))
        setAviso({ tipo: 'cola', texto: 'Esta casilla ya tiene acta capturada. Al guardar se reemplaza.' })
      })
      .catch(() => {
        // 404 es lo normal: todavía no hay captura.
      })

    return () => {
      vigente = false
    }
  }, [idCasilla, idEleccion])

  /* -------------------------------- guardar ------------------------------- */

  /** Arma la carga útil a partir de lo que está en pantalla. */
  function datosDeCaptura() {
    if (!casilla || !idEleccion) return null
    return {
      id_cliente: nuevoUuid(),
      id_casilla: casilla.id,
      id_eleccion: idEleccion,
      total_acta: total,
      no_registrados: noRegNum,
      nulos: nulosNum,
      votos: opciones
        .map((o) => ({ id_opcion: o.id, votos: entero(votos[o.id] ?? '') }))
        .filter((v) => v.votos > 0),
      autor_texto: null,
    }
  }

  /** Guarda en el teléfono sin intentar enviar. */
  async function guardarSinEnviar() {
    const datos = datosDeCaptura()
    if (!casilla || !datos) return
    await cola.encolar({
      id_cliente: datos.id_cliente,
      creado: Date.now(),
      casilla: `${casilla.clave} · ${casilla.municipio}`,
      eleccion: eleccion?.nombre ?? '',
      datos,
      intentos: 0,
    })
    setAviso({
      tipo: 'cola',
      texto: 'Guardada en el teléfono. Se enviará al recuperar la conexión.',
    })
  }

  async function guardar() {
    if (!casilla || !idEleccion) return
    setGuardando(true)
    setAviso(null)

    const datos = datosDeCaptura()
    if (!datos) {
      setGuardando(false)
      return
    }

    try {
      await capturaServicio.guardar(datos)
      setAviso({ tipo: 'ok', texto: `Guardada: ${casilla.clave}.` })
    } catch (e) {
      // estado 0 = no hubo respuesta: se guarda en el teléfono.
      if (e instanceof ErrorApi && e.estado === 0) {
        await cola.encolar({
          id_cliente: datos.id_cliente,
          creado: Date.now(),
          casilla: `${casilla.clave} · ${casilla.municipio}`,
          eleccion: eleccion?.nombre ?? '',
          datos,
          intentos: 0,
        })
        setAviso({
          tipo: 'cola',
          texto: 'Sin conexión. La captura quedó guardada en el teléfono.',
        })
      } else {
        setAviso({
          tipo: 'error',
          texto: e instanceof Error ? e.message : 'No se pudo guardar',
        })
      }
    } finally {
      setGuardando(false)
    }
  }

  useEffect(() => {
    const alCambiar = () => setEnLinea(navigator.onLine)
    window.addEventListener('online', alCambiar)
    window.addEventListener('offline', alCambiar)
    return () => {
      window.removeEventListener('online', alCambiar)
      window.removeEventListener('offline', alCambiar)
    }
  }, [])

  const reiniciar = () => {
    const mapa: Record<number, string> = {}
    opciones.forEach((o) => {
      mapa[o.id] = ''
    })
    setVotos(mapa)
    setTotalActa('')
    setNulos('')
    setNoRegistrados('')
    setAviso(null)
  }

  const clasesCampo =
    'w-full rounded-lg border border-borde bg-superficie px-3 py-2.5 text-base text-texto'

  const numeroDe = (id: number) => votos[id] ?? ''

  return (
    <div className="flex min-h-full flex-col">
      {/* Confirmación flotante: un segundo y se va. El error no pasa por
          aquí, se queda en la franja de arriba para que dé tiempo a leerlo. */}
      {aviso && aviso.tipo !== 'error' && (
        <AvisoFlotante
          tipo={aviso.tipo}
          texto={aviso.texto}
          duracionMs={aviso.tipo === 'ok' ? 1000 : 1800}
          alCerrar={() => setAviso(null)}
        />
      )}
      <div className="flex-1 px-4 pb-6 pt-4">
        {/* Los errores se quedan a la vista: hay que leerlos y corregir algo. */}
        {aviso && aviso.tipo === 'error' && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <span>{aviso.texto}</span>
          </div>
        )}

        {/* Selección: una columna, campos grandes.

            El proceso no se elige: se toma el vigente. Quien captura en una
            casilla no tiene por qué escogerlo, y un desplegable de más es una
            forma de equivocarse. Solo se muestra cuál está en uso. */}
        <div className="mb-4 space-y-3 rounded-xl border border-borde bg-superficie p-4">

          <label className="block text-sm text-texto-tenue">
            Elección
            <select
              value={idEleccion ?? ''}
              onChange={(e) => cambiar('id_eleccion', e.target.value, ['seccion', 'id_casilla'])}
              className={`mt-1 ${clasesCampo}`}
            >
              {elecciones.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-texto-tenue">
            Municipio
            <select
              value={idMunicipio ?? ''}
              onChange={(e) => cambiar('id_municipio', e.target.value, ['seccion', 'id_casilla'])}
              className={`mt-1 ${clasesCampo}`}
            >
              <option value="">Elige municipio</option>
              {municipios.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm text-texto-tenue">
              Sección
              <select
                value={claveSeccion}
                onChange={(e) => cambiar('seccion', e.target.value, ['id_casilla'])}
                disabled={secciones.length === 0}
                className={`mt-1 ${clasesCampo}`}
              >
                <option value="">—</option>
                {secciones.map((s) => (
                  <option key={s.id} value={s.clave}>
                    {s.clave}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-texto-tenue">
              Casilla
              <select
                value={idCasilla ?? ''}
                onChange={(e) => cambiar('id_casilla', e.target.value)}
                disabled={casillas.length === 0}
                className={`mt-1 ${clasesCampo}`}
              >
                <option value="">—</option>
                {casillas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.clave}
                    {c.capturada ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Boleta en dos columnas.
            
            Una boleta de 2021 tiene 25 opciones: en una sola columna son más
            de dos pantallas de scroll, y quien captura pierde el renglón donde
            iba. En dos columnas cabe casi en una.
            
            Cada opción es una celda cerrada con su etiqueta a la izquierda y
            su campo a la derecha, para que no haya duda de a cuál pertenece el
            número. Por debajo de 360 px de ancho vuelve a una columna: ahí dos
            partirían las etiquetas largas y el riesgo de equivocarse sube. */}
        {casilla && opciones.length > 0 && (
          <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
            {opciones.map((o, i) => (
              <label
                key={o.id}
                title={o.etiqueta}
                className="flex min-h-14 items-center justify-between gap-2 rounded-xl border border-borde bg-superficie px-3 py-2 transition-colors focus-within:border-primario"
              >
                <span className="min-w-0 truncate text-xs leading-tight text-texto-tenue">
                  {o.etiqueta}
                </span>
                <input
                  value={numeroDe(o.id)}
                  onChange={(e) =>
                    setVotos((prev) => ({ ...prev, [o.id]: e.target.value.replace(/\D/g, '') }))
                  }
                  inputMode="numeric"
                  pattern="[0-9]*"
                  enterKeyHint={i === opciones.length - 1 ? 'done' : 'next'}
                  placeholder="0"
                  className="w-16 shrink-0 rounded-lg border border-borde bg-fondo px-2 py-1.5 text-right text-lg tabular-nums text-texto focus:border-primario focus:outline-none"
                />
              </label>
            ))}
          </div>
        )}

        {!casilla && (
          <p className="px-1 py-6 text-center text-sm text-texto-tenue">
            Elige municipio, sección y casilla para empezar.
          </p>
        )}
      </div>

      {/* Resumen al final del contenido, no fijo.

          Fijo ocupaba casi un tercio de la pantalla y dejaba la boleta en una
          ventana pequeña. Con la boleta en dos columnas, el resumen queda a un
          desplazamiento corto y el espacio se aprovecha para leer los votos. */}
      {casilla && (
        <div className="mx-4 mb-4 rounded-xl border border-borde bg-superficie p-4">
          <div className="mb-3 grid grid-cols-3 gap-2">
            <label className="text-xs text-texto-tenue">
              No registrados
              <input
                value={noRegistrados}
                onChange={(e) => setNoRegistrados(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                placeholder="0"
                className="mt-1 w-full rounded-lg border border-borde bg-fondo px-2 py-2 text-right text-base tabular-nums text-texto focus:border-primario focus:outline-none"
              />
            </label>
            <label className="text-xs text-texto-tenue">
              Nulos
              <input
                value={nulos}
                onChange={(e) => setNulos(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                placeholder="0"
                className="mt-1 w-full rounded-lg border border-borde bg-fondo px-2 py-2 text-right text-base tabular-nums text-texto focus:border-primario focus:outline-none"
              />
            </label>
            <label className="text-xs text-texto-tenue">
              Total del acta
              <input
                value={totalActa}
                onChange={(e) => setTotalActa(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                placeholder="0"
                className="mt-1 w-full rounded-lg border border-borde bg-fondo px-2 py-2 text-right text-base tabular-nums text-texto focus:border-primario focus:outline-none"
              />
            </label>
          </div>

          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-texto-tenue">
              Suma {suma.toLocaleString('es-MX')}
              {total > 0 && (
                <>
                  {' · '}
                  <span className={cuadra ? 'text-primario' : 'text-amber-700 dark:text-amber-400'}>
                    {cuadra ? 'Cuadra' : `Diferencia ${diferencia.toLocaleString('es-MX')}`}
                  </span>
                </>
              )}
            </span>
            <button
              onClick={reiniciar}
              className="rounded-lg px-2 py-1 text-xs text-texto-tenue underline-offset-2 hover:underline"
            >
              Limpiar
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={guardar}
              disabled={guardando}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primario py-3 text-base font-medium text-white transition-opacity disabled:opacity-50"
            >
              <Save size={18} />
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>

            {/* Solo sin conexión, y solo para guardar en el teléfono.
                Antes este botón llevaba a «Pendientes» y se llevaba lo
                capturado: la pantalla se desmontaba y no quedaba nada. */}
            {!enLinea && (
              <button
                onClick={() => void guardarSinEnviar()}
                className="flex items-center justify-center gap-2 rounded-lg border border-borde px-4 py-3 text-sm text-texto-tenue"
              >
                <CloudOff size={16} />
                Sin enviar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
