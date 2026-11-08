import { useEffect, useState } from 'react'
import { procesoServicio } from '../api/procesoServicio'
import type { Eleccion, Proceso } from '../types'

/** Insignia de estado, con el color del tema. */
function Insignia({ activo, texto }: { activo: boolean; texto: string }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        activo ? 'bg-primario-suave text-primario-texto' : 'bg-fondo-alt text-texto-tenue',
      ].join(' ')}
    >
      {texto}
    </span>
  )
}

/**
 * Catálogo de procesos electorales.
 *
 * Al elegir uno se cargan sus elecciones a la derecha.
 */
export function Procesos() {
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [seleccionado, setSeleccionado] = useState<Proceso | null>(null)
  const [elecciones, setElecciones] = useState<Eleccion[]>([])
  const [cargando, setCargando] = useState(true)
  const [cargandoElecciones, setCargandoElecciones] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    procesoServicio
      .listar()
      .then((datos) => {
        setProcesos(datos)
        const activo = datos.find((p) => p.activo) ?? datos[0]
        if (activo) seleccionar(activo)
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function seleccionar(proceso: Proceso) {
    setSeleccionado(proceso)
    setCargandoElecciones(true)
    procesoServicio
      .elecciones(proceso.id)
      .then(setElecciones)
      .catch((e) => setError(e.message))
      .finally(() => setCargandoElecciones(false))
  }

  if (cargando) return <p className="text-sm text-texto-tenue">Cargando procesos…</p>

  if (error) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
        {error}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-texto">Procesos electorales</h1>
        <p className="mt-1 text-sm text-texto-tenue">Elige un proceso para ver sus elecciones.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-tenue">
                <th className="px-4 py-3 font-medium">Año</th>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Jornada</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {procesos.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => seleccionar(p)}
                  className={[
                    'cursor-pointer border-b border-borde transition-colors last:border-0',
                    seleccionado?.id === p.id ? 'bg-primario-suave' : 'hover:bg-fondo-alt',
                  ].join(' ')}
                >
                  <td className="px-4 py-3 font-medium text-texto">{p.anio}</td>
                  <td className="px-4 py-3 text-texto">{p.nombre}</td>
                  <td className="px-4 py-3 text-texto-tenue">{p.fecha_jornada ?? 'Por definir'}</td>
                  <td className="px-4 py-3">
                    <Insignia activo={p.activo} texto={p.activo ? 'Vigente' : p.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="rounded-xl border border-borde bg-superficie p-5">
          <h2 className="text-sm font-semibold text-texto">
            {seleccionado ? `Elecciones ${seleccionado.anio}` : 'Elecciones'}
          </h2>

          {cargandoElecciones && <p className="mt-3 text-sm text-texto-tenue">Cargando…</p>}

          {!cargandoElecciones && elecciones.length === 0 && (
            <p className="mt-3 text-sm text-texto-tenue">
              Este proceso todavía no tiene elecciones.
            </p>
          )}

          <ul className="mt-3 space-y-2">
            {elecciones.map((e) => (
              <li key={e.id} className="rounded-lg border border-borde px-3 py-2">
                <p className="text-sm font-medium text-texto">{e.nombre}</p>
                <p className="text-xs text-texto-tenue">
                  {e.clave} · {e.tipo}
                </p>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}