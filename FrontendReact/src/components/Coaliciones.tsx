import { useEffect, useState } from 'react'
import { Check, ImagePlus, Save, Trash2 } from 'lucide-react'
import { cliente } from '../api/cliente'

interface Coalicion {
  id: number
  clave: string
  nombre: string
  color: string | null
  activa: boolean
  tiene_logo: boolean
  integrantes: string
}

/** Logo de la coalición, descargado con token y mostrado desde su URL temporal. */
function LogoCoalicion({ id, version }: { id: number; version: number }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    setUrl(null)

    cliente
      .get<Blob>(`/catalogos/coaliciones/${id}/logo`, { responseType: 'blob', timeout: 15000 })
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
      <div className="flex h-10 w-10 items-center justify-center rounded border border-dashed border-borde text-texto-tenue">
        <ImagePlus size={16} />
      </div>
    )
  }

  return (
    <img src={url} alt="Logo" className="h-10 w-10 rounded border border-borde object-contain" />
  )
}

/**
 * Catálogo de coaliciones del proceso.
 *
 * Una coalición se arma con partidos y pertenece a la jornada: no se hereda de
 * un proceso a otro. Aquí se ajusta lo que se ve —nombre, color y logo— y se
 * activa o desactiva. Los integrantes salen de la base y no se editan aquí.
 */
export function Coaliciones() {
  const [coaliciones, setCoaliciones] = useState<Coalicion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<number | null>(null)
  const [guardado, setGuardado] = useState<number | null>(null)
  const [versionLogo, setVersionLogo] = useState<Record<number, number>>({})

  const cargar = () =>
    cliente
      .get<Coalicion[]>('/catalogos/coaliciones')
      .then((r) => setCoaliciones(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar'))

  useEffect(() => {
    void cargar().finally(() => setCargando(false))
  }, [])

  function editar(id: number, cambios: Partial<Coalicion>) {
    setCoaliciones((prev) => prev.map((c) => (c.id === id ? { ...c, ...cambios } : c)))
    setGuardado(null)
  }

  async function guardar(c: Coalicion) {
    setGuardando(c.id)
    setError(null)
    try {
      await cliente.put(`/catalogos/coaliciones/${c.id}`, {
        nombre: c.nombre,
        color: c.color,
        activa: c.activa,
      })
      setGuardado(c.id)
      window.setTimeout(() => setGuardado(null), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setGuardando(null)
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
      await cliente.post(`/catalogos/coaliciones/${id}/logo`, datos, {
        headers: { 'Content-Type': undefined },
        timeout: 30000,
      })
      setVersionLogo((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
      setCoaliciones((prev) =>
        prev.map((c) => (c.id === id ? { ...c, tiene_logo: true } : c)),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir el logo')
    }
  }

  async function quitarLogo(id: number) {
    setError(null)
    try {
      await cliente.delete(`/catalogos/coaliciones/${id}/logo`)
      setVersionLogo((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
      setCoaliciones((prev) =>
        prev.map((c) => (c.id === id ? { ...c, tiene_logo: false } : c)),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo quitar el logo')
    }
  }

  if (cargando) return <p className="p-6 text-sm text-texto-tenue">Cargando…</p>

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-texto">Coaliciones</h1>
        <p className="mt-1 text-sm text-texto-tenue">
          Las del proceso electoral en curso. El color y el logo se usan en las gráficas de
          resultados.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {coaliciones.length === 0 ? (
        <p className="rounded-xl border border-borde bg-superficie p-6 text-sm text-texto-tenue">
          Este proceso no tiene coaliciones registradas.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borde bg-fondo-alt text-left text-xs uppercase tracking-wide text-texto-tenue">
                <th className="px-3 py-2 font-medium">Logo</th>
                <th className="px-3 py-2 font-medium">Color</th>
                <th className="px-3 py-2 font-medium">Clave</th>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Integrantes</th>
                <th className="px-3 py-2 font-medium">Activa</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {coaliciones.map((c) => (
                <tr key={c.id} className="border-b border-borde-tenue last:border-0">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <LogoCoalicion id={c.id} version={versionLogo[c.id] ?? 0} />
                      <div className="flex flex-col gap-0.5">
                        <label
                          className="cursor-pointer rounded border border-borde px-1.5 py-0.5 text-[10px] text-texto-tenue hover:text-primario"
                          title="Subir o cambiar el logo"
                        >
                          {c.tiene_logo ? 'Cambiar' : 'Subir'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const archivo = e.target.files?.[0]
                              if (archivo) void subirLogo(c.id, archivo)
                              e.target.value = ''
                            }}
                          />
                        </label>
                        {c.tiene_logo && (
                          <button
                            onClick={() => void quitarLogo(c.id)}
                            className="rounded px-1.5 py-0.5 text-[10px] text-texto-tenue hover:text-red-600"
                            title="Quitar el logo"
                          >
                            <Trash2 size={10} className="inline" /> Quitar
                          </button>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-2">
                    <input
                      type="color"
                      value={c.color ?? '#546E7A'}
                      onChange={(e) => editar(c.id, { color: e.target.value.toUpperCase() })}
                      className="h-8 w-12 cursor-pointer rounded border border-borde bg-superficie"
                      title="Color de la coalición"
                    />
                  </td>

                  <td className="px-3 py-2 font-mono text-xs text-texto">{c.clave}</td>

                  <td className="px-3 py-2">
                    <input
                      value={c.nombre}
                      onChange={(e) => editar(c.id, { nombre: e.target.value })}
                      className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-texto hover:border-borde focus:border-borde focus:bg-superficie"
                    />
                  </td>

                  <td className="px-3 py-2 text-xs text-texto-tenue">
                    {c.integrantes || '—'}
                  </td>

                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={c.activa}
                      onChange={(e) => editar(c.id, { activa: e.target.checked })}
                      className="h-4 w-4 cursor-pointer"
                    />
                  </td>

                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => void guardar(c)}
                      disabled={guardando === c.id}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                        guardado === c.id
                          ? 'bg-primario/10 text-primario'
                          : 'bg-primario text-white'
                      } disabled:opacity-50`}
                    >
                      {guardado === c.id ? <Check size={12} /> : <Save size={12} />}
                      {guardando === c.id ? '…' : guardado === c.id ? 'Guardado' : 'Guardar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-texto-tenue">
        Los integrantes vienen de la carga del proceso y no se editan aquí. Cambiar el color lo
        cambia en las boletas de las elecciones donde aparece esta coalición.
      </p>
    </div>
  )
}
