import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Search, Trash2 } from 'lucide-react'
import { capturistaServicio } from '../api/capturistaServicio'
import { municipioServicio } from '../api/municipioServicio'
import { procesoServicio } from '../api/procesoServicio'
import { seccionServicio } from '../api/seccionServicio'
import type { Municipio, Proceso, Seccion } from '../types'

/**
 * Alta y edición de un capturista.
 *
 * Pantalla propia y no un panel lateral: asignar secciones necesita espacio, y
 * en una columna estrecha la lista queda en una tira de tres renglones.
 *
 * Se asignan SECCIONES, no casillas. De cada una salen todas sus casillas.
 */
export function CapturistaFormulario() {
  const { id } = useParams()
  const navegar = useNavigate()
  const esNuevo = !id

  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [municipios, setMunicipios] = useState<Municipio[]>([])

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [activo, setActivo] = useState(true)
  const [seleccion, setSeleccion] = useState<number[]>([])
  const [seccionesGuardadas, setSeccionesGuardadas] = useState<
    { id: number; clave: string; municipio: string; casillas: number }[]
  >([])

  const [idMunicipio, setIdMunicipio] = useState<number | null>(null)
  const [disponibles, setDisponibles] = useState<Seccion[]>([])
  const [busqueda, setBusqueda] = useState('')

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const numero = (n: number) => n.toLocaleString('es-MX')

  useEffect(() => {
    procesoServicio
      .listar()
      .then(async (ps) => {
        setProcesos(ps)
        const activoProceso = ps.find((p) => p.activo) ?? ps[0]
        if (activoProceso) setMunicipios(await municipioServicio.listar(activoProceso.id))
      })
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (esNuevo) {
      setCargando(false)
      return
    }
    capturistaServicio
      .obtener(Number(id))
      .then((c) => {
        setNombre(c.nombre)
        setTelefono(c.telefono ?? '')
        setActivo(c.activo)
        setSeccionesGuardadas(c.secciones)
        setSeleccion(c.secciones.map((s) => s.id))
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [id, esNuevo])

  useEffect(() => {
    if (!idMunicipio) {
      setDisponibles([])
      return
    }
    const proceso = procesos.find((p) => p.activo) ?? procesos[0]
    if (!proceso) return
    seccionServicio
      .listar(idMunicipio, proceso.id)
      .then(setDisponibles)
      .catch((e) => setError(e.message))
  }, [idMunicipio, procesos])

  const filtradas = useMemo(() => {
    const t = busqueda.trim()
    if (!t) return disponibles
    return disponibles.filter((s) => s.clave.includes(t))
  }, [disponibles, busqueda])

  /** Secciones marcadas, con su municipio y cuántas casillas aportan. */
  const marcadas = useMemo(() => {
    const mapa = new Map<number, { clave: string; municipio: string; casillas: number }>()
    seccionesGuardadas.forEach((s) =>
      mapa.set(s.id, { clave: s.clave, municipio: s.municipio, casillas: s.casillas }),
    )
    disponibles.forEach((s) =>
      mapa.set(s.id, {
        clave: s.clave,
        municipio: municipios.find((m) => m.id === s.id_municipio)?.nombre ?? '',
        casillas: s.casillas,
      }),
    )
    return seleccion
      .map((seccionId) => ({ id: seccionId, ...mapa.get(seccionId) }))
      .filter((s) => s.clave !== undefined)
      .sort((a, b) => (a.municipio ?? '').localeCompare(b.municipio ?? '') || Number(a.clave) - Number(b.clave))
  }, [seleccion, seccionesGuardadas, disponibles, municipios])

  const totalCasillas = marcadas.reduce((t, s) => t + (s.casillas ?? 0), 0)

  async function guardar() {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const datos = {
        nombre: nombre.trim(),
        telefono: telefono.trim() || null,
        activo,
        secciones: seleccion,
      }
      if (esNuevo) await capturistaServicio.crear(datos)
      else await capturistaServicio.actualizar(Number(id), datos)
      navegar('/capturistas')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    if (esNuevo) return
    if (!window.confirm('¿Eliminar este capturista? Se borran sus teléfonos.')) return
    await capturistaServicio.eliminar(Number(id))
    navegar('/capturistas')
  }

  const campo =
    'w-full rounded-lg border border-borde bg-superficie px-3 py-2.5 text-sm text-texto'

  if (cargando) {
    return <p className="p-6 text-sm text-texto-tenue">Cargando…</p>
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <Link
          to="/capturistas"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-texto-tenue hover:text-texto"
        >
          <ArrowLeft size={15} />
          Capturistas
        </Link>
        <h1 className="text-xl font-semibold text-texto">
          {esNuevo ? 'Nuevo capturista' : 'Editar capturista'}
        </h1>
        <p className="mt-1 text-sm text-texto-tenue">
          Se le asignan secciones completas; sus casillas salen de ellas.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Datos */}
      <section className="mb-4 rounded-xl border border-borde bg-superficie p-5">
        <h2 className="mb-4 text-sm font-semibold text-texto">Datos</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs text-texto-tenue">
            Nombre completo
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre y apellidos"
              className={`mt-1 ${campo}`}
            />
          </label>
          <label className="block text-xs text-texto-tenue">
            Teléfono de contacto
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Opcional"
              className={`mt-1 ${campo}`}
            />
          </label>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-texto">
          <input
            type="checkbox"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            className="h-4 w-4 accent-[var(--primario)]"
          />
          Activo
          <span className="text-xs text-texto-tenue">
            — un capturista inactivo no puede enrolar teléfonos nuevos
          </span>
        </label>
      </section>

      {/* Secciones */}
      <section className="mb-4 rounded-xl border border-borde bg-superficie p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-sm font-semibold text-texto">Secciones asignadas</h2>
          <span className="text-xs text-texto-tenue">
            {numero(marcadas.length)} secciones · {numero(totalCasillas)} casillas
          </span>
        </div>

        {marcadas.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {marcadas.map((s) => (
              <span
                key={s.id}
                className="flex items-center gap-1 rounded-md bg-fondo-alt px-2 py-1 text-xs text-texto"
                title={`${s.municipio} · ${s.casillas} casillas`}
              >
                {s.clave}
                <button
                  onClick={() => setSeleccion((prev) => prev.filter((x) => x !== s.id))}
                  className="text-texto-tenue hover:text-red-600"
                  title="Quitar"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            <select
              value={idMunicipio ?? ''}
              onChange={(e) => {
                setIdMunicipio(Number(e.target.value) || null)
                setBusqueda('')
              }}
              className={campo}
            >
              <option value="">Elegir municipio…</option>
              {municipios.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>

            {idMunicipio && (
              <label className="relative block">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue"
                />
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar sección…"
                  className={`${campo} pl-8`}
                />
              </label>
            )}
          </div>

          <div>
            {!idMunicipio && (
              <p className="rounded-lg border border-dashed border-borde p-6 text-center text-sm text-texto-tenue">
                Elige un municipio para ver sus secciones.
              </p>
            )}

            {idMunicipio && filtradas.length === 0 && (
              <p className="rounded-lg border border-dashed border-borde p-6 text-center text-sm text-texto-tenue">
                {busqueda ? 'Ninguna sección coincide.' : 'Este municipio no tiene secciones cargadas.'}
              </p>
            )}

            {idMunicipio && filtradas.length > 0 && (
              <div className="grid max-h-72 grid-cols-2 gap-1 overflow-y-auto rounded-lg border border-borde p-2 sm:grid-cols-3 lg:grid-cols-4">
                {filtradas.map((s) => {
                  const marcada = seleccion.includes(s.id)
                  return (
                    <label
                      key={s.id}
                      className={`flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-2 text-sm ${
                        marcada ? 'bg-primario/10' : 'hover:bg-fondo-alt'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={marcada}
                          onChange={() =>
                            setSeleccion((prev) =>
                              marcada ? prev.filter((x) => x !== s.id) : [...prev, s.id],
                            )
                          }
                          className="h-4 w-4 accent-[var(--primario)]"
                        />
                        <span className="text-texto">{s.clave}</span>
                      </span>
                      <span className="text-xs text-texto-tenue">{s.casillas}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => void guardar()}
          disabled={guardando}
          className="rounded-lg bg-primario px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : esNuevo ? 'Crear capturista' : 'Guardar cambios'}
        </button>
        <Link
          to="/capturistas"
          className="rounded-lg border border-borde px-5 py-2.5 text-sm text-texto-tenue"
        >
          Cancelar
        </Link>
        {!esNuevo && (
          <button
            onClick={() => void eliminar()}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-borde px-4 py-2.5 text-sm text-texto-tenue hover:text-red-600"
          >
            <Trash2 size={15} />
            Eliminar
          </button>
        )}
      </div>
    </div>
  )
}
