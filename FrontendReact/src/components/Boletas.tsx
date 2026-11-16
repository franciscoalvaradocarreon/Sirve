import { useEffect, useState } from 'react'
import { Check, ImagePlus, Plus, Save, Trash2 } from 'lucide-react'
import { cliente } from '../api/cliente'

interface Eleccion {
  id: number
  nombre: string
  orden: number
  anio: number
  id_proceso: number
}

interface Opcion {
  id: number
  id_eleccion: number
  tipo: string
  etiqueta: string
  color: string | null
  orden: number
  activo: boolean
  tiene_logo: boolean
  id_partido: number | null
  id_coalicion: number | null
  integrantes: string
}

interface Disponible {
  id: number
  clave: string
  nombre: string
  color: string | null
}

interface Partido {
  id: number
  clave: string
  nombre: string
  color: string | null
}

/** Logo de la opción, descargado con token y mostrado desde su URL temporal. */
function LogoOpcion({ id, version }: { id: number; version: number }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    setUrl(null)
    cliente
      .get<Blob>(`/catalogos/boletas/opcion/${id}/logo`, { responseType: 'blob', timeout: 15000 })
      .then((r) => {
        if (vigente) setUrl(URL.createObjectURL(r.data))
      })
      .catch(() => {
        // Sin logo no es un error.
      })
    return () => {
      vigente = false
    }
  }, [id, version])

  if (!url) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded border border-dashed border-borde text-texto-tenue">
        <ImagePlus size={14} />
      </div>
    )
  }
  return <img src={url} alt="" className="h-9 w-9 rounded border border-borde object-contain" />
}

/**
 * Boletas por elección.
 *
 * Es donde se arma la papeleta: qué partidos van, con qué coaliciones y en qué
 * orden. La clave de cada opción se escribe una sola vez, porque es la que el
 * capturista lee en el acta.
 *
 * Una opción con votos capturados no se borra: se desactiva. Borrarla dejaría
 * capturas apuntando a algo que ya no existe.
 */
export function Boletas() {
  const [elecciones, setElecciones] = useState<Eleccion[]>([])
  const [elegida, setElegida] = useState<number | null>(null)
  const [opciones, setOpciones] = useState<Opcion[]>([])
  const [disponibles, setDisponibles] = useState<Disponible[]>([])
  const [partidos, setPartidos] = useState<Partido[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<number | null>(null)
  const [guardado, setGuardado] = useState<number | null>(null)
  const [versionLogo, setVersionLogo] = useState<Record<number, number>>({})

  // alta
  const [agregandoPartido, setAgregandoPartido] = useState(false)
  const [idPartido, setIdPartido] = useState<number | ''>('')
  const [armandoCoalicion, setArmandoCoalicion] = useState(false)
  const [coalicion, setCoalicion] = useState({ clave: '', color: '#1A237E' })
  const [integrantes, setIntegrantes] = useState<number[]>([])

  useEffect(() => {
    Promise.all([
      cliente.get<Eleccion[]>('/catalogos/boletas/elecciones'),
      cliente.get<Partido[]>('/catalogos/partidos'),
    ])
      .then(([e, p]) => {
        setElecciones(e.data)
        setPartidos(p.data)
        if (e.data.length > 0) setElegida(e.data[0].id)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar'))
      .finally(() => setCargando(false))
  }, [])

  const cargarBoleta = (idEleccion: number) =>
    cliente
      .get<{ opciones: Opcion[]; disponibles: Disponible[] }>(`/catalogos/boletas/${idEleccion}`)
      .then((r) => {
        setOpciones(r.data.opciones)
        setDisponibles(r.data.disponibles)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar la boleta'))

  useEffect(() => {
    if (elegida) void cargarBoleta(elegida)
  }, [elegida])

  function editar(id: number, cambios: Partial<Opcion>) {
    setOpciones((prev) => prev.map((o) => (o.id === id ? { ...o, ...cambios } : o)))
    setGuardado(null)
  }

  async function guardar(o: Opcion) {
    setGuardando(o.id)
    setError(null)
    try {
      await cliente.put(`/catalogos/boletas/opcion/${o.id}`, {
        etiqueta: o.etiqueta,
        color: o.color,
        orden: o.orden,
        activo: o.activo,
      })
      setGuardado(o.id)
      window.setTimeout(() => setGuardado(null), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setGuardando(null)
    }
  }

  async function quitar(o: Opcion) {
    if (!window.confirm(`¿Quitar «${o.etiqueta}» de la boleta?`)) return
    setError(null)
    try {
      await cliente.delete(`/catalogos/boletas/opcion/${o.id}`)
      if (elegida) await cargarBoleta(elegida)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo quitar')
    }
  }

  async function subirLogo(id: number, archivo: File) {
    setError(null)
    if (archivo.size > 512 * 1024) {
      setError('El logo no debe pasar de 512 KB.')
      return
    }
    try {
      const datos = new FormData()
      datos.append('archivo', archivo)
      await cliente.post(`/catalogos/boletas/opcion/${id}/logo`, datos, {
        headers: { 'Content-Type': undefined },
        timeout: 30000,
      })
      setVersionLogo((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
      setOpciones((prev) => prev.map((o) => (o.id === id ? { ...o, tiene_logo: true } : o)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir el logo')
    }
  }

  async function agregarPartido() {
    if (!elegida || idPartido === '') return
    setError(null)
    try {
      await cliente.post(`/catalogos/boletas/${elegida}/partido`, { idPartido })
      setAgregandoPartido(false)
      setIdPartido('')
      await cargarBoleta(elegida)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo agregar')
    }
  }

  async function agregarCoalicion() {
    if (!elegida || !coalicion.clave || integrantes.length === 0) return
    setError(null)
    try {
      await cliente.post(`/catalogos/boletas/${elegida}/coalicion`, {
        clave: coalicion.clave,
        color: coalicion.color,
        idPartidos: integrantes,
      })
      setArmandoCoalicion(false)
      setCoalicion({ clave: '', color: '#1A237E' })
      setIntegrantes([])
      await cargarBoleta(elegida)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la coalición')
    }
  }

  if (cargando) return <p className="p-6 text-sm text-texto-tenue">Cargando…</p>

  const campo = 'rounded-lg border border-borde bg-superficie px-2 py-1.5 text-sm text-texto'

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-texto">Boletas</h1>
        <p className="mt-1 text-sm text-texto-tenue">
          Qué aparece en la papeleta de cada elección. La clave es la que el capturista lee en el
          acta: se escribe una vez y no se cambia.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="text-sm text-texto-tenue">
          Elección
          <select
            value={elegida ?? ''}
            onChange={(e) => setElegida(Number(e.target.value))}
            className={`ml-2 ${campo}`}
          >
            {elecciones.map((e) => (
              <option key={e.id} value={e.id}>
                {e.anio} · {e.nombre}
              </option>
            ))}
          </select>
        </label>

        <span className="ml-auto flex gap-2">
          <button
            onClick={() => {
              setAgregandoPartido((v) => !v)
              setArmandoCoalicion(false)
            }}
            className="flex items-center gap-1.5 rounded-lg border border-borde px-3 py-1.5 text-sm text-texto-tenue hover:text-primario"
          >
            <Plus size={14} />
            Agregar partido
          </button>
          <button
            onClick={() => {
              setArmandoCoalicion((v) => !v)
              setAgregandoPartido(false)
            }}
            className="flex items-center gap-1.5 rounded-lg bg-primario px-3 py-1.5 text-sm font-medium text-white"
          >
            <Plus size={14} />
            Nueva coalición
          </button>
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {agregandoPartido && (
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-borde bg-superficie p-3">
          <label className="text-xs text-texto-tenue">
            Partido
            <select
              value={idPartido}
              onChange={(e) => setIdPartido(e.target.value === '' ? '' : Number(e.target.value))}
              className={`mt-1 block ${campo}`}
            >
              <option value="">Elige…</option>
              {disponibles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.clave} · {p.nombre}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => void agregarPartido()}
            disabled={idPartido === ''}
            className="rounded-lg bg-primario px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Agregar
          </button>
          {disponibles.length === 0 && (
            <span className="text-xs text-texto-tenue">Todos los partidos activos ya están.</span>
          )}
        </div>
      )}

      {armandoCoalicion && (
        <div className="mb-4 rounded-xl border border-borde bg-superficie p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-texto-tenue">
              Clave
              <input
                value={coalicion.clave}
                onChange={(e) =>
                  setCoalicion({ ...coalicion, clave: e.target.value.toUpperCase() })
                }
                placeholder="C_PAN_PRI"
                className={`mt-1 block w-40 ${campo}`}
              />
            </label>
            <label className="text-xs text-texto-tenue">
              Color
              <input
                type="color"
                value={coalicion.color}
                onChange={(e) => setCoalicion({ ...coalicion, color: e.target.value.toUpperCase() })}
                className={`mt-1 block h-9 w-16 cursor-pointer ${campo}`}
              />
            </label>
          </div>

          <p className="mt-3 text-xs text-texto-tenue">Integrantes</p>
          <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-3">
            {partidos.map((p) => (
              <label key={p.id} className="flex items-center gap-1.5 text-xs text-texto">
                <input
                  type="checkbox"
                  checked={integrantes.includes(p.id)}
                  onChange={(e) =>
                    setIntegrantes((prev) =>
                      e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id),
                    )
                  }
                  className="h-3.5 w-3.5"
                />
                {p.clave}
              </label>
            ))}
          </div>

          <button
            onClick={() => void agregarCoalicion()}
            disabled={!coalicion.clave || integrantes.length === 0}
            className="mt-3 rounded-lg bg-primario px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Crear y agregar
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-borde bg-fondo-alt text-left text-xs uppercase tracking-wide text-texto-tenue">
              <th className="px-3 py-2 font-medium">Logo</th>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Clave</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Integrantes</th>
              <th className="px-3 py-2 font-medium">Color</th>
              <th className="px-3 py-2 font-medium">Activa</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {opciones.map((o) => (
              <tr key={o.id} className="border-b border-borde-tenue last:border-0">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <LogoOpcion id={o.id} version={versionLogo[o.id] ?? 0} />
                    <div className="flex flex-col gap-0.5">
                      <label className="cursor-pointer rounded border border-borde px-1.5 py-0.5 text-[10px] text-texto-tenue hover:text-primario">
                        {o.tiene_logo ? 'Cambiar' : 'Subir'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const archivo = e.target.files?.[0]
                            if (archivo) void subirLogo(o.id, archivo)
                            e.target.value = ''
                          }}
                        />
                      </label>
                      {o.tiene_logo && (
                        <button
                          onClick={async () => {
                            await cliente.delete(`/catalogos/boletas/opcion/${o.id}/logo`)
                            setVersionLogo((v) => ({ ...v, [o.id]: (v[o.id] ?? 0) + 1 }))
                            setOpciones((prev) =>
                              prev.map((x) => (x.id === o.id ? { ...x, tiene_logo: false } : x)),
                            )
                          }}
                          className="rounded px-1.5 py-0.5 text-[10px] text-texto-tenue hover:text-red-600"
                        >
                          <Trash2 size={10} className="inline" /> Quitar
                        </button>
                      )}
                    </div>
                  </div>
                </td>

                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={o.orden}
                    onChange={(e) => editar(o.id, { orden: Number(e.target.value) })}
                    className="w-14 rounded border border-borde bg-superficie px-1.5 py-1 text-xs text-texto"
                  />
                </td>

                <td className="px-3 py-2">
                  <input
                    value={o.etiqueta}
                    onChange={(e) => editar(o.id, { etiqueta: e.target.value })}
                    className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 font-mono text-xs text-texto hover:border-borde focus:border-borde focus:bg-superficie"
                  />
                </td>

                <td className="px-3 py-2 text-xs text-texto-tenue">
                  {o.tipo === 'COALICION' ? 'Coalición' : o.tipo === 'PARTIDO' ? 'Partido' : o.tipo}
                </td>

                <td className="px-3 py-2 text-xs text-texto-tenue">{o.integrantes || '—'}</td>

                <td className="px-3 py-2">
                  <input
                    type="color"
                    value={o.color ?? '#546E7A'}
                    onChange={(e) => editar(o.id, { color: e.target.value.toUpperCase() })}
                    className="h-8 w-12 cursor-pointer rounded border border-borde bg-superficie"
                  />
                </td>

                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={o.activo}
                    onChange={(e) => editar(o.id, { activo: e.target.checked })}
                    className="h-4 w-4 cursor-pointer"
                  />
                </td>

                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <button
                    onClick={() => void quitar(o)}
                    className="mr-1 rounded p-1.5 text-texto-tenue hover:text-red-600"
                    title="Quitar de la boleta"
                  >
                    <Trash2 size={13} />
                  </button>
                  <button
                    onClick={() => void guardar(o)}
                    disabled={guardando === o.id}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                      guardado === o.id ? 'bg-primario/10 text-primario' : 'bg-primario text-white'
                    } disabled:opacity-50`}
                  >
                    {guardado === o.id ? <Check size={12} /> : <Save size={12} />}
                    {guardando === o.id ? '…' : guardado === o.id ? 'Guardado' : 'Guardar'}
                  </button>
                </td>
              </tr>
            ))}

            {opciones.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-texto-tenue">
                  Esta elección no tiene opciones en la boleta.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-texto-tenue">
        Una opción con votos capturados no se deja borrar: se desactiva, y deja de aparecer en la
        captura conservando lo ya registrado.
      </p>
    </div>
  )
}
