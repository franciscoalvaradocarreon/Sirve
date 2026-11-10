import { useEffect, useMemo, useState } from 'react'
import { Copy, KeyRound, Plus, Smartphone, Trash2, UserPlus } from 'lucide-react'
import { capturistaServicio } from '../api/capturistaServicio'
import { municipioServicio } from '../api/municipioServicio'
import { procesoServicio } from '../api/procesoServicio'
import { seccionServicio } from '../api/seccionServicio'
import type {
  Capturista,
  CodigoEnrolamiento,
  Municipio,
  Proceso,
  Seccion,
  Telefono,
} from '../types'

/**
 * Capturistas: alta, secciones asignadas y teléfonos.
 *
 * Se asignan SECCIONES, no casillas: en campo se reparte la sección completa y
 * de ahí salen todas sus casillas.
 *
 * El código de enrolamiento se muestra una sola vez. El servidor guarda su
 * hash, así que no hay forma de volver a verlo: si se pierde, se reemite.
 */
export function Capturistas() {
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [municipios, setMunicipios] = useState<Municipio[]>([])
  const [lista, setLista] = useState<Capturista[]>([])
  const [elegido, setElegido] = useState<Capturista | null>(null)
  const [telefonos, setTelefonos] = useState<Telefono[]>([])
  const [codigo, setCodigo] = useState<CodigoEnrolamiento | null>(null)

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [activo, setActivo] = useState(true)
  const [seleccion, setSeleccion] = useState<number[]>([])

  const [idMunicipio, setIdMunicipio] = useState<number | null>(null)
  const [seccionesDisponibles, setSeccionesDisponibles] = useState<Seccion[]>([])
  const [busqueda, setBusqueda] = useState('')

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const numero = (n: number) => n.toLocaleString('es-MX')

  useEffect(() => {
    procesoServicio
      .listar()
      .then(async (ps) => {
        setProcesos(ps)
        const activoProceso = ps.find((p) => p.activo) ?? ps[0]
        if (activoProceso) {
          const ms = await municipioServicio.listar(activoProceso.id)
          setMunicipios(ms)
        }
      })
      .catch((e) => setError(e.message))

    recargar()
  }, [])

  function recargar() {
    setCargando(true)
    capturistaServicio
      .listar()
      .then(setLista)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }

  // Secciones del municipio elegido, para agregarlas
  useEffect(() => {
    if (!idMunicipio) {
      setSeccionesDisponibles([])
      return
    }
    const proceso = procesos.find((p) => p.activo) ?? procesos[0]
    if (!proceso) return
    seccionServicio
      .listar(idMunicipio, proceso.id)
      .then(setSeccionesDisponibles)
      .catch((e) => setError(e.message))
  }, [idMunicipio, procesos])

  function abrir(c: Capturista) {
    setElegido(c)
    setNombre(c.nombre)
    setTelefono(c.telefono ?? '')
    setActivo(c.activo)
    setSeleccion(c.secciones.map((s) => s.id))
    setCodigo(null)
    setIdMunicipio(null)
    capturistaServicio.telefonos(c.id).then(setTelefonos).catch(() => setTelefonos([]))
  }

  function nuevo() {
    setElegido(null)
    setNombre('')
    setTelefono('')
    setActivo(true)
    setSeleccion([])
    setCodigo(null)
    setTelefonos([])
    setIdMunicipio(null)
  }

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
      const guardado = elegido
        ? await capturistaServicio.actualizar(elegido.id, datos)
        : await capturistaServicio.crear(datos)
      setElegido(guardado)
      recargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    if (!elegido) return
    if (!window.confirm(`¿Eliminar a ${elegido.nombre}? Se borran sus teléfonos.`)) return
    await capturistaServicio.eliminar(elegido.id)
    nuevo()
    recargar()
  }

  async function generarCodigo() {
    if (!elegido) return
    try {
      setCodigo(await capturistaServicio.nuevoTelefono(elegido.id))
      setTelefonos(await capturistaServicio.telefonos(elegido.id))
      recargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el código')
    }
  }

  async function reemitir(idDispositivo: number) {
    try {
      setCodigo(await capturistaServicio.reemitirCodigo(idDispositivo))
      setTelefonos(await capturistaServicio.telefonos(elegido!.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo reemitir')
    }
  }

  async function desactivarTelefono(idDispositivo: number) {
    if (!elegido) return
    if (!window.confirm('¿Desactivar este teléfono? Dejará de poder capturar.')) return
    await capturistaServicio.desactivarTelefono(idDispositivo)
    setTelefonos(await capturistaServicio.telefonos(elegido.id))
  }

  const filtradas = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    if (!t) return seccionesDisponibles
    return seccionesDisponibles.filter((s) => s.clave.includes(t))
  }, [seccionesDisponibles, busqueda])

  const seccionesElegidas = useMemo(() => {
    if (!elegido) return []
    return elegido.secciones
  }, [elegido])

  const casillasTotales = useMemo(
    () => seccionesElegidas.reduce((t, s) => t + s.casillas, 0),
    [seccionesElegidas],
  )

  const campo =
    'w-full rounded-lg border border-borde bg-superficie px-3 py-2 text-sm text-texto'

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-texto">Capturistas</h1>
          <p className="mt-1 text-sm text-texto-tenue">
            {numero(lista.length)} personas · se les asignan secciones, no casillas
          </p>
        </div>
        <button
          onClick={nuevo}
          className="flex items-center gap-2 rounded-lg bg-primario px-3 py-2 text-sm font-medium text-white"
        >
          <UserPlus size={16} />
          Nuevo capturista
        </button>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Lista */}
        <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-tenue">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 text-right font-medium">Secciones</th>
                <th className="px-4 py-3 text-right font-medium">Casillas</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {cargando && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-texto-tenue">
                    Cargando…
                  </td>
                </tr>
              )}
              {!cargando && lista.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-texto-tenue">
                    Todavía no hay capturistas.
                  </td>
                </tr>
              )}
              {lista.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => abrir(c)}
                  className={`cursor-pointer border-b border-borde last:border-0 hover:bg-fondo-alt ${
                    elegido?.id === c.id ? 'bg-fondo-alt' : ''
                  }`}
                >
                  <td className="px-4 py-2.5 text-texto">
                    {c.nombre}
                    {c.telefono && (
                      <span className="ml-2 text-xs text-texto-tenue">{c.telefono}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-texto-tenue">
                    {numero(c.secciones.length)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-texto-tenue">
                    {numero(c.casillas)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        c.activo
                          ? 'bg-primario/10 text-primario'
                          : 'bg-fondo-alt text-texto-tenue'
                      }`}
                    >
                      {c.activo ? 'activo' : 'inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detalle */}
        <div className="space-y-4">
          <div className="rounded-xl border border-borde bg-superficie p-4">
            <h2 className="mb-3 text-sm font-semibold text-texto">
              {elegido ? 'Editar capturista' : 'Nuevo capturista'}
            </h2>

            <label className="block text-xs text-texto-tenue">
              Nombre
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={`mt-1 ${campo}`} />
            </label>

            <label className="mt-3 block text-xs text-texto-tenue">
              Teléfono
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className={`mt-1 ${campo}`}
              />
            </label>

            <label className="mt-3 flex items-center gap-2 text-sm text-texto">
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                className="h-4 w-4 accent-[var(--primario)]"
              />
              Activo
            </label>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => void guardar()}
                disabled={guardando}
                className="flex-1 rounded-lg bg-primario py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {guardando ? 'Guardando…' : elegido ? 'Guardar cambios' : 'Crear'}
              </button>
              {elegido && (
                <button
                  onClick={() => void eliminar()}
                  className="rounded-lg border border-borde px-3 py-2 text-sm text-texto-tenue hover:text-red-600"
                  title="Eliminar"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Secciones */}
          <div className="rounded-xl border border-borde bg-superficie p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-texto">Secciones</h2>
              <span className="text-xs text-texto-tenue">
                {seleccion.length} secc. · {numero(casillasTotales)} casillas
              </span>
            </div>

            {seccionesElegidas.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {seccionesElegidas.map((s) => (
                  <span
                    key={s.id}
                    className="rounded-md bg-fondo-alt px-2 py-1 text-xs text-texto"
                    title={`${s.municipio} · ${s.casillas} casillas`}
                  >
                    {s.clave}
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <select
                value={idMunicipio ?? ''}
                onChange={(e) => setIdMunicipio(Number(e.target.value) || null)}
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
                <>
                  <input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar sección…"
                    className={campo}
                  />
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-borde">
                    {filtradas.length === 0 && (
                      <p className="p-3 text-xs text-texto-tenue">Sin secciones.</p>
                    )}
                    {filtradas.map((s) => {
                      const marcada = seleccion.includes(s.id)
                      return (
                        <label
                          key={s.id}
                          className="flex cursor-pointer items-center justify-between gap-2 border-b border-borde px-3 py-2 text-sm last:border-0 hover:bg-fondo-alt"
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={marcada}
                              onChange={() =>
                                setSeleccion((prev) =>
                                  marcada
                                    ? prev.filter((x) => x !== s.id)
                                    : [...prev, s.id],
                                )
                              }
                              className="h-4 w-4 accent-[var(--primario)]"
                            />
                            <span className="text-texto">{s.clave}</span>
                          </span>
                          <span className="text-xs text-texto-tenue">
                            {s.casillas} casillas
                          </span>
                        </label>
                      )
                    })}
                  </div>
                  <p className="text-xs text-texto-tenue">
                    Los cambios se aplican al guardar.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Teléfonos */}
          {elegido && (
            <div className="rounded-xl border border-borde bg-superficie p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-texto">Teléfonos</h2>
                <button
                  onClick={() => void generarCodigo()}
                  className="flex items-center gap-1.5 rounded-lg border border-primario px-2.5 py-1.5 text-xs font-medium text-primario"
                >
                  <Plus size={13} />
                  Generar código
                </button>
              </div>

              {telefonos.length === 0 && (
                <p className="text-xs text-texto-tenue">Ningún teléfono enrolado.</p>
              )}

              <ul className="space-y-2">
                {telefonos.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 text-texto">
                      <Smartphone size={14} className="text-texto-tenue" />
                      {t.nombre ?? 'Teléfono'}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          t.enrolado
                            ? 'bg-primario/10 text-primario'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {t.enrolado ? 'enrolado' : 'sin enrolar'}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <button
                        onClick={() => void reemitir(t.id)}
                        className="rounded p-1.5 text-texto-tenue hover:text-primario"
                        title="Reemitir código"
                      >
                        <KeyRound size={14} />
                      </button>
                      <button
                        onClick={() => void desactivarTelefono(t.id)}
                        className="rounded p-1.5 text-texto-tenue hover:text-red-600"
                        title="Desactivar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>

              {codigo && (
                <div className="mt-3 rounded-lg border border-primario/40 bg-primario/10 p-3">
                  <p className="text-xs text-texto-tenue">
                    Código para el teléfono · se muestra una sola vez
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="font-mono text-xl tracking-[0.2em] text-texto">
                      {codigo.codigo}
                    </span>
                    <button
                      onClick={() => void navigator.clipboard?.writeText(codigo.codigo)}
                      className="rounded p-1.5 text-texto-tenue hover:text-primario"
                      title="Copiar"
                    >
                      <Copy size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
