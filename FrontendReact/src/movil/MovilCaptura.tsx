import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Camera, CheckCircle2, CloudOff, Download, Save } from 'lucide-react'
import { ErrorApi } from '../api/cliente'
import { capturaServicio } from '../api/capturaServicio'
import { dispositivoServicio } from '../api/dispositivoServicio'
import { eleccionServicio } from '../api/eleccionServicio'
import { procesoServicio } from '../api/procesoServicio'
import { cola, type CapturaEnCola } from '../utils/cola'
import { leerCache } from '../utils/cache'
import { cargarConRespaldo, guardarCatalogo, hayCatalogo, leerCatalogo } from '../utils/almacen'
import {
  claveBorrador,
  guardarBorrador,
  leerBorrador,
  limpiarBorrador,
} from '../utils/borrador'
import { nuevoUuid } from '../utils/uuid'
import { fotoServicio } from '../api/fotoServicio'
import { colaFotos, comprimirFoto } from '../utils/foto'
import { useProceso } from './ProcesoContext'
import { AvisoFlotante } from './AvisoFlotante'
import type {
  CasillaAsignada,
  Eleccion,
  OpcionBoleta,
  Proceso,
} from '../types'

/**
 * Captura en el teléfono.
 *
 * El capturista no elige municipio ni sección: ve la lista de sus casillas,
 * que le asignaron al darlo de alta. Diez, doce, las que le toquen.
 *
 * Funciona sin conexión. La preparación baja solo lo suyo —sus casillas y la
 * boleta de cada elección—, así que son kilobytes y no megabytes.
 */
export function MovilCaptura() {
  const [parametros, setParametros] = useSearchParams()
  const { setProceso } = useProceso()

  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [elecciones, setElecciones] = useState<Eleccion[]>([])
  const [opciones, setOpciones] = useState<OpcionBoleta[]>([])
  const [asignadas, setAsignadas] = useState<CasillaAsignada[]>([])

  const [votos, setVotos] = useState<Record<number, string>>({})
  const [totalActa, setTotalActa] = useState('')
  const [nulos, setNulos] = useState('')
  const [noRegistrados, setNoRegistrados] = useState('')

  const [enLinea, setEnLinea] = useState(navigator.onLine)
  const [guardando, setGuardando] = useState(false)
  const [preparando, setPreparando] = useState(false)
  const [progreso, setProgreso] = useState<string | null>(null)
  const [piezas, setPiezas] = useState({ listas: 0, total: 0 })
  const [enCola, setEnCola] = useState<CapturaEnCola[]>([])
  /** Foto elegida que todavía no se ha subido: espera al botón Guardar. */
  const [fotoNueva, setFotoNueva] = useState<Blob | null>(null)
  const [fotoEstado, setFotoEstado] = useState<'ninguna' | 'porEnviar' | 'enviada'>('ninguna')
  const [fotoVista, setFotoVista] = useState<string | null>(null)
  const [fotoCargando, setFotoCargando] = useState(false)
  const [aviso, setAviso] = useState<
    { tipo: 'ok' | 'cola' | 'info' | 'error'; texto: string } | null
  >(null)

  const idProceso = Number(parametros.get('id_proceso')) || null
  const idEleccion = Number(parametros.get('id_eleccion')) || null
  const idCasilla = Number(parametros.get('id_casilla')) || null

  const proceso = procesos.find((p) => p.id === idProceso) ?? null
  const eleccion = elecciones.find((e) => e.id === idEleccion) ?? null
  const casilla = asignadas.find((c) => c.id === idCasilla) ?? null

  useEffect(() => {
    const alCambiar = () => setEnLinea(navigator.onLine)
    window.addEventListener('online', alCambiar)
    window.addEventListener('offline', alCambiar)
    return () => {
      window.removeEventListener('online', alCambiar)
      window.removeEventListener('offline', alCambiar)
    }
  }, [])

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
    const guardado = leerCache<Proceso[]>('procesos')
    if (guardado) setProcesos(guardado)

    cargarConRespaldo('procesos', () => procesoServicio.listar())
      .then((datos) => {
        if (!datos) return
        setProcesos(datos)
        if (!idProceso && datos.length > 0) {
          const activo = datos.find((p) => p.activo) ?? datos[0]
          setParametros(
            (prev) => {
              if (!prev.get('id_proceso')) prev.set('id_proceso', String(activo.id))
              return prev
            },
            { replace: true },
          )
        }
      })
      .catch(() => setAviso({ tipo: 'error', texto: 'Sin datos guardados del proceso.' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!idProceso) return
    const guardadas = leerCache<Eleccion[]>(`elecciones:${idProceso}`)
    if (guardadas) setElecciones(guardadas)

    cargarConRespaldo(`elecciones:${idProceso}`, () =>
      procesoServicio.elecciones(idProceso),
    ).then((datos) => {
      if (!datos) return
      setElecciones(datos)
      if (!idEleccion && datos.length > 0) cambiar('id_eleccion', String(datos[0].id))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idProceso])

  useEffect(() => {
    setProceso(proceso)
  }, [proceso, setProceso])

  /** Boleta de la elección. */
  useEffect(() => {
    if (!idEleccion) {
      setOpciones([])
      return
    }
    leerCatalogo<OpcionBoleta[]>(`opciones:${idEleccion}`).then((guardadas) => {
      if (guardadas && guardadas.length > 0) setOpciones(guardadas)
    })
    cargarConRespaldo(`opciones:${idEleccion}`, () =>
      eleccionServicio.opciones(idEleccion),
    ).then((datos) => {
      if (datos) setOpciones(datos)
    })
  }, [idEleccion])

  /** Las casillas de este teléfono: lo único que puede capturar. */
  useEffect(() => {
    if (!idEleccion) {
      setAsignadas([])
      return
    }
    leerCatalogo<CasillaAsignada[]>(`mias:${idEleccion}`).then((guardadas) => {
      if (guardadas && guardadas.length > 0) setAsignadas(guardadas)
    })
    cargarConRespaldo(`mias:${idEleccion}`, () =>
      dispositivoServicio.misCasillas(idEleccion),
    ).then((datos) => {
      if (datos) setAsignadas(datos)
    })
  }, [idEleccion])

  /* --------------------------- qué está guardado -------------------------- */

  useEffect(() => {
    if (!idProceso) {
      setPiezas({ listas: 0, total: 0 })
      return
    }
    let vigente = true
    ;(async () => {
      let listas = 0
      for (const el of elecciones) {
        const [c, o] = await Promise.all([
          hayCatalogo(`mias:${el.id}`).catch(() => false),
          hayCatalogo(`opciones:${el.id}`).catch(() => false),
        ])
        if (c && o) listas += 1
      }
      if (vigente) setPiezas({ listas, total: elecciones.length })
    })()
    return () => {
      vigente = false
    }
  }, [idProceso, elecciones, asignadas, opciones])

  const listoSinConexion = piezas.total > 0 && piezas.listas === piezas.total

  /* ------------------------- capturas sin enviar ------------------------- */

  const recargarCola = () => {
    cola.listar().then(setEnCola).catch(() => setEnCola([]))
  }

  useEffect(() => {
    recargarCola()
  }, [idCasilla, idEleccion])

  /** Casillas con algo esperando en el teléfono. */
  const pendientesPorCasilla = useMemo(
    () =>
      new Set(
        enCola
          .filter((f) => f.datos.id_eleccion === idEleccion)
          .map((f) => f.datos.id_casilla),
      ),
    [enCola, idEleccion],
  )

  /* --------------------------- captura existente -------------------------- */

  useEffect(() => {
    setVotos({})
    setTotalActa('')
    setNulos('')
    setNoRegistrados('')
    setAviso(null)
    if (!idCasilla || !idEleccion) return

    let vigente = true

    ;(async () => {
      // Primero el teléfono: una captura hecha sin conexión vive en la cola y
      // el servidor no sabe de ella.
      const enEspera = await cola.buscar(idCasilla, idEleccion).catch(() => null)
      if (!vigente) return

      if (enEspera) {
        const mapa: Record<number, string> = {}
        enEspera.datos.votos.forEach((v) => {
          mapa[v.id_opcion] = String(v.votos)
        })
        setVotos(mapa)
        setTotalActa(String(enEspera.datos.total_acta))
        setNulos(String(enEspera.datos.nulos))
        setNoRegistrados(String(enEspera.datos.no_registrados))
        setAviso({
          tipo: 'info',
          texto: 'Esta casilla tiene un acta capturada en el teléfono, sin enviar.',
        })
        return
      }

      try {
        const c = await capturaServicio.consultar(idCasilla, idEleccion)
        if (!vigente) return
        const detalle = await capturaServicio.votos(idCasilla, idEleccion)
        if (!vigente) return
        const mapa: Record<number, string> = {}
        detalle.forEach((v) => {
          mapa[v.id_opcion] = String(v.votos)
        })
        setVotos(mapa)
        setTotalActa(String(c.total_acta))
        setNulos(String(c.nulos))
        setNoRegistrados(String(c.no_registrados))
        setAviso({ tipo: 'info', texto: 'Esta casilla ya tiene acta. Al guardar se reemplaza.' })
      } catch {
        if (!vigente) return
        const borrador = leerBorrador(claveBorrador(idCasilla, idEleccion))
        if (!borrador) return
        setVotos(borrador.votos)
        setTotalActa(borrador.totalActa)
        setNulos(borrador.nulos)
        setNoRegistrados(borrador.noRegistrados)
        setAviso({ tipo: 'info', texto: 'Se recuperó lo que llevabas escrito.' })
      }
    })()

    return () => {
      vigente = false
    }
  }, [idCasilla, idEleccion])

  /*
   * Estado de la foto de esta casilla.
   *
   * Primero se mira la cola del teléfono —una foto tomada sin señal vive ahí—
   * y después el servidor. La vista previa solo se arma desde la cola: bajar
   * la imagen del servidor para mostrarla sería gastar datos para nada.
   */
  useEffect(() => {
    setFotoEstado('ninguna')
    setFotoVista(null)
    // Cambiar de casilla descarta la foto elegida que no se guardó: pertenecía
    // a la casilla anterior.
    setFotoNueva(null)
    if (!idCasilla || !idEleccion) return

    let vigente = true
    ;(async () => {
      const enCola = await colaFotos.buscar(idCasilla, idEleccion).catch(() => null)
      if (!vigente) return
      if (enCola) {
        setFotoEstado('porEnviar')
        setFotoVista(URL.createObjectURL(enCola.archivo))
        return
      }
      if (!navigator.onLine) return
      const existe = await fotoServicio.existe(idCasilla, idEleccion).catch(() => false)
      if (vigente && existe) setFotoEstado('enviada')
    })()

    return () => {
      vigente = false
    }
  }, [idCasilla, idEleccion])

  /**
   * Toma la foto y la deja lista, sin subirla.
   *
   * Se comprime aquí para que el peso esté resuelto, pero el envío espera al
   * botón Guardar: la foto pertenece al acta, y subirla antes de guardar los
   * resultados dejaría una imagen sin captura.
   */
  async function elegirFoto(archivo: File) {
    if (!idCasilla || !idEleccion) return
    setFotoCargando(true)
    setAviso(null)
    try {
      const comprimida = await comprimirFoto(archivo)
      setFotoNueva(comprimida)
      setFotoVista(URL.createObjectURL(comprimida))
    } catch {
      setAviso({ tipo: 'error', texto: 'No se pudo leer la imagen.' })
    } finally {
      setFotoCargando(false)
    }
  }

  /** Sube la foto elegida, o la deja en la cola si no hay red. */
  async function subirFotoPendiente() {
    if (!fotoNueva || !idCasilla || !idEleccion) return
    try {
      await fotoServicio.subir(idCasilla, idEleccion, fotoNueva)
      await colaFotos.eliminar(idCasilla, idEleccion)
      setFotoNueva(null)
      setFotoEstado('enviada')
    } catch (e) {
      if (e instanceof ErrorApi && e.estado === 0) {
        await colaFotos.guardar({
          clave: `${idCasilla}:${idEleccion}`,
          idCasilla,
          idEleccion,
          archivo: fotoNueva,
          creado: Date.now(),
        })
        setFotoNueva(null)
        setFotoEstado('porEnviar')
      } else {
        setAviso({
          tipo: 'error',
          texto: e instanceof Error ? e.message : 'No se pudo subir la foto',
        })
      }
    }
  }
  /** Borrador: se guarda conforme se escribe. */
  useEffect(() => {
    if (!idCasilla || !idEleccion) return
    const vacio =
      Object.values(votos).every((v) => !v) && !totalActa && !nulos && !noRegistrados
    const clave = claveBorrador(idCasilla, idEleccion)
    if (vacio) {
      limpiarBorrador(clave)
      return
    }
    guardarBorrador(clave, { votos, totalActa, nulos, noRegistrados })
  }, [idCasilla, idEleccion, votos, totalActa, nulos, noRegistrados])

  /* --------------------------- preparar sin red --------------------------- */

  /**
   * Descarga lo del capturista: sus casillas y la boleta, en cada elección.
   *
   * Son kilobytes, no los megabytes de antes: ya no hace falta el proceso
   * entero porque él solo captura unas cuantas casillas.
   */
  async function preparar() {
    if (!idProceso) return
    setPreparando(true)
    setAviso(null)
    const fallos: string[] = []

    for (let i = 0; i < elecciones.length; i += 1) {
      const el = elecciones[i]
      setProgreso(`${i + 1}/${elecciones.length}`)
      try {
        const op = await eleccionServicio.opciones(el.id)
        await guardarCatalogo(`opciones:${el.id}`, op)
        if (el.id === idEleccion) setOpciones(op)
      } catch {
        fallos.push(`boleta de ${el.nombre}`)
      }
      try {
        const mias = await dispositivoServicio.misCasillas(el.id)
        await guardarCatalogo(`mias:${el.id}`, mias)
        if (el.id === idEleccion) setAsignadas(mias)
      } catch {
        fallos.push(`casillas de ${el.nombre}`)
      }
    }

    setPreparando(false)
    setProgreso(null)

    if (fallos.length === 0) {
      setAviso({ tipo: 'ok', texto: 'Listo para trabajar sin señal.' })
    } else {
      setAviso({
        tipo: 'error',
        texto: `No se pudo descargar: ${fallos.join(', ')}. Revisa la conexión.`,
      })
    }
  }

  /* -------------------------------- guardar ------------------------------- */

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

  async function quitarPendienteAnterior() {
    if (!idCasilla || !idEleccion) return
    const previa = await cola.buscar(idCasilla, idEleccion).catch(() => null)
    if (previa) await cola.eliminar(previa.id_cliente)
  }

  async function guardarSinEnviar() {
    const datos = datosDeCaptura()
    if (!casilla || !datos) return
    await quitarPendienteAnterior()
    await cola.encolar({
      id_cliente: datos.id_cliente,
      creado: Date.now(),
      casilla: `${casilla.clave} · ${casilla.municipio}`,
      eleccion: eleccion?.nombre ?? '',
      datos,
      intentos: 0,
    })
    await subirFotoPendiente()
    setAviso({
      tipo: 'cola',
      texto: 'Guardada en el teléfono. Se enviará al recuperar la conexión.',
    })
    recargarCola()
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
    await quitarPendienteAnterior()

    try {
      await capturaServicio.guardar(datos)
      limpiarBorrador(claveBorrador(datos.id_casilla, datos.id_eleccion))
      // La foto viaja con el acta: primero los números, después la imagen.
      await subirFotoPendiente()
      setAviso({ tipo: 'ok', texto: `Guardada: ${casilla.clave}.` })
    } catch (e) {
      if (e instanceof ErrorApi && e.estado === 0) {
        await cola.encolar({
          id_cliente: datos.id_cliente,
          creado: Date.now(),
          casilla: `${casilla.clave} · ${casilla.municipio}`,
          eleccion: eleccion?.nombre ?? '',
          datos,
          intentos: 0,
        })
        await subirFotoPendiente()
        setAviso({
          tipo: 'cola',
          texto: 'Sin conexión. La captura y la foto quedaron en el teléfono.',
        })
      } else {
        setAviso({
          tipo: 'error',
          texto: e instanceof Error ? e.message : 'No se pudo guardar',
        })
      }
    } finally {
      setGuardando(false)
      recargarCola()
    }
  }

  const reiniciar = () => {
    if (idCasilla && idEleccion) limpiarBorrador(claveBorrador(idCasilla, idEleccion))
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

  const numeroDe = (id: number) => votos[id] ?? ''

  return (
    <div className="flex min-h-full flex-col">
      {/* Todos los avisos son flotantes y de un segundo: confirmaciones,
          avisos de sin conexión y errores. */}
      {aviso && (
        <AvisoFlotante
          tipo={aviso.tipo}
          texto={aviso.texto}
          duracionMs={1000}
          alCerrar={() => setAviso(null)}
        />
      )}

      <div className="flex-1 px-4 pb-6 pt-4">
        {/* Elección. Es lo único que el capturista elige. */}
        <div className="mb-4 space-y-3 rounded-xl border border-borde bg-superficie p-4">
          <label className="block text-sm text-texto-tenue">
            Elección
            <select
              value={idEleccion ?? ''}
              onChange={(e) => cambiar('id_eleccion', e.target.value, ['id_casilla'])}
              className="mt-1 w-full rounded-lg border border-borde bg-superficie px-3 py-2.5 text-base text-texto"
            >
              {elecciones.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </label>

          {/* Sus casillas, en un combo: con diez o más, una lista de botones
              ocupa media pantalla y empuja la boleta hacia abajo. */}
          <label className="block text-sm text-texto-tenue">
            Casilla
            <select
              value={idCasilla ?? ''}
              onChange={(e) => cambiar('id_casilla', e.target.value)}
              disabled={asignadas.length === 0}
              className="mt-1 w-full rounded-lg border border-borde bg-superficie px-3 py-2.5 text-base text-texto disabled:opacity-50"
            >
              {asignadas.length === 0 && <option value="">Sin casillas asignadas</option>}
              {idCasilla === null && asignadas.length > 0 && (
                <option value="">Elige casilla…</option>
              )}
              {asignadas.map((c) => {
                const pendiente = pendientesPorCasilla.has(c.id)
                const marca = pendiente ? ' •' : c.capturada ? ' ✓' : ''
                return (
                  <option key={c.id} value={c.id}>
                    Sec. {c.seccion} · {c.tipo}{marca}
                  </option>
                )
              })}
            </select>
          </label>

          {asignadas.length === 0 && (
            <p className="text-xs text-texto-tenue">
              {enLinea
                ? 'No tienes casillas asignadas en esta elección.'
                : 'Sin conexión y sin casillas guardadas. Prepara el teléfono con red.'}
            </p>
          )}

          {casilla && (
            <p className="truncate text-xs text-texto-tenue">
              {casilla.municipio}
              {pendientesPorCasilla.has(casilla.id)
                ? ' · sin enviar'
                : casilla.capturada
                  ? ' · capturada'
                  : ''}
            </p>
          )}
        </div>
        {/* Preparación para trabajar sin señal */}
        {idProceso && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-borde bg-superficie px-4 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm text-texto">
                {listoSinConexion && (
                  <CheckCircle2 size={15} className="shrink-0 text-primario" />
                )}
                {listoSinConexion
                  ? 'Listo para trabajar sin señal'
                  : piezas.listas > 0
                    ? 'Preparación incompleta'
                    : 'Sin descargar en este teléfono'}
              </p>
              <p className="mt-0.5 truncate text-xs text-texto-tenue">
                {listoSinConexion
                  ? `${piezas.total} elecciones · ${asignadas.length} casillas`
                  : `Faltan ${piezas.total - piezas.listas} de ${piezas.total} elecciones`}
              </p>
            </div>

            <button
              onClick={() => void preparar()}
              disabled={preparando || !enLinea || elecciones.length === 0}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-primario px-3 py-2 text-sm font-medium text-primario disabled:opacity-40"
            >
              <Download size={15} />
              {preparando ? (progreso ?? 'Descargando…') : listoSinConexion ? 'Actualizar' : 'Preparar'}
            </button>
          </div>
        )}

        {/* Boleta en dos columnas */}
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

        {!casilla && asignadas.length > 0 && (
          <p className="px-1 py-6 text-center text-sm text-texto-tenue">
            Elige una casilla para capturar.
          </p>
        )}
      </div>

      {/* Foto del acta. Opcional: la captura se guarda igual sin ella. */}
      {casilla && (
        <div className="mx-4 mb-4 rounded-xl border border-borde bg-superficie p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-texto">Foto del acta</p>
              <p className="mt-0.5 text-xs text-texto-tenue">
                {fotoNueva
                  ? 'Se enviará al guardar el acta.'
                  : fotoEstado === 'enviada'
                    ? 'Ya está en el servidor.'
                    : fotoEstado === 'porEnviar'
                      ? 'Guardada en el teléfono, sin enviar.'
                      : 'Opcional. Se envía junto con la captura.'}
              </p>
            </div>

            <label
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
                fotoCargando
                  ? 'border-borde text-texto-tenue opacity-50'
                  : 'border-primario text-primario'
              }`}
            >
              <Camera size={15} />
              {fotoCargando ? 'Leyendo…' : fotoEstado === 'ninguna' ? 'Tomar foto' : 'Cambiar'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                disabled={fotoCargando}
                onChange={(e) => {
                  const archivo = e.target.files?.[0]
                  if (archivo) void elegirFoto(archivo)
                  e.target.value = ''
                }}
                className="hidden"
              />
            </label>
          </div>

          {fotoVista && (
            <img
              src={fotoVista}
              alt="Acta capturada"
              className="mt-3 max-h-40 w-full rounded-lg border border-borde object-cover"
            />
          )}

          {fotoEstado === 'porEnviar' && !fotoNueva && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <CloudOff size={13} />
              Se enviará al recuperar la conexión.
            </p>
          )}
        </div>
      )}

      {/* Resumen al final del contenido */}
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
              onClick={() => void guardar()}
              disabled={guardando}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primario py-3 text-base font-medium text-white transition-opacity disabled:opacity-50"
            >
              <Save size={18} />
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>

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
