import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, FileUp, KeyRound, Pencil, Search, Smartphone, Trash2, UserPlus } from 'lucide-react'
import { capturistaServicio } from '../api/capturistaServicio'
import type { Capturista, CodigoEnrolamiento, Telefono } from '../types'

/**
 * Lista de capturistas.
 *
 * Aquí solo se consulta, se entra a editar y se generan los códigos de los
 * teléfonos. El alta y la asignación de secciones viven en su propia pantalla:
 * en una columna estrecha no caben.
 */
export function Capturistas() {
  const [lista, setLista] = useState<Capturista[]>([])
  const [elegido, setElegido] = useState<Capturista | null>(null)
  const [telefonos, setTelefonos] = useState<Telefono[]>([])
  const [codigo, setCodigo] = useState<CodigoEnrolamiento | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  /**
   * Filtra por nombre sin distinguir mayúsculas ni acentos.
   *
   * «jose» debe encontrar a «José Luis Ramírez»: quien busca en un teléfono
   * rara vez escribe el acento, y no encontrar a alguien por eso sería peor
   * que no tener buscador.
   */
  const filtrados = useMemo(() => {
    const t = sinAcentos(busqueda.trim())
    if (!t) return lista
    return lista.filter((c) => sinAcentos(c.nombre).includes(t))
  }, [lista, busqueda])

  const numero = (n: number) => n.toLocaleString('es-MX')

  function recargar() {
    setCargando(true)
    capturistaServicio
      .listar()
      .then(setLista)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }

  useEffect(recargar, [])

  async function seleccionar(c: Capturista) {
    setElegido(c)
    setCodigo(null)
    setTelefonos(await capturistaServicio.telefonos(c.id).catch(() => []))
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
    if (!elegido) return
    try {
      setCodigo(await capturistaServicio.reemitirCodigo(idDispositivo))
      setTelefonos(await capturistaServicio.telefonos(elegido.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo reemitir')
    }
  }

  /**
   * Elimina al capturista.
   *
   * Se lleva sus secciones y sus teléfonos (la base lo hace en cascada), pero
   * NO sus capturas: esas quedan sin dueño, con `id_capturista` en nulo. El
   * dato capturado es del proceso electoral, no de la persona.
   */
  async function eliminar(c: Capturista) {
    const aviso =
      `¿Eliminar a ${c.nombre}?\n\n` +
      `Se borran sus ${c.secciones.length} secciones asignadas y sus teléfonos.\n` +
      `Sus capturas se conservan, sin quedar ligadas a nadie.`
    if (!window.confirm(aviso)) return

    try {
      await capturistaServicio.eliminar(c.id)
      if (elegido?.id === c.id) {
        setElegido(null)
        setTelefonos([])
      }
      recargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar')
    }
  }

  async function desactivar(idDispositivo: number) {
    if (!elegido) return
    if (!window.confirm('¿Desactivar este teléfono? Dejará de poder capturar.')) return
    await capturistaServicio.desactivarTelefono(idDispositivo)
    setTelefonos(await capturistaServicio.telefonos(elegido.id))
    recargar()
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-texto">Capturistas</h1>
          <p className="mt-1 text-sm text-texto-tenue">
            {busqueda.trim()
              ? `${numero(filtrados.length)} de ${numero(lista.length)} coinciden`
              : `${numero(lista.length)} personas · se les asignan secciones`}
          </p>
        </div>
        <label className="relative w-56">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue"
          />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre…"
            className="w-full rounded-lg border border-borde bg-superficie py-2 pl-9 pr-3 text-sm text-texto placeholder:text-texto-tenue"
          />
        </label>

        <span className="flex gap-2">
          <Link
            to="/capturistas/importar"
            className="flex items-center gap-2 rounded-lg border border-borde px-3 py-2 text-sm text-texto-tenue hover:text-primario"
          >
            <FileUp size={16} />
            Importar
          </Link>
          <Link
            to="/capturistas/nuevo"
            className="flex items-center gap-2 rounded-lg bg-primario px-3 py-2 text-sm font-medium text-white"
          >
            <UserPlus size={16} />
            Nuevo capturista
          </Link>
        </span>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-xl border border-borde bg-superficie">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-tenue">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 text-right font-medium">Secciones</th>
                <th className="px-4 py-3 text-right font-medium">Casillas</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {cargando && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-texto-tenue">
                    Cargando…
                  </td>
                </tr>
              )}

              {!cargando && lista.length > 0 && filtrados.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-texto-tenue">
                    Nadie coincide con «{busqueda}».
                  </td>
                </tr>
              )}

              {!cargando && lista.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-texto-tenue">
                    Todavía no hay capturistas.
                    <br />
                    <Link to="/capturistas/nuevo" className="mt-2 inline-block text-primario">
                      Dar de alta al primero
                    </Link>
                  </td>
                </tr>
              )}

              {filtrados.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => void seleccionar(c)}
                  className={`cursor-pointer border-b border-borde last:border-0 hover:bg-fondo-alt ${
                    elegido?.id === c.id ? 'bg-fondo-alt' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-texto">
                    {c.nombre}
                    {c.telefono && (
                      <span className="ml-2 text-xs text-texto-tenue">{c.telefono}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-texto-tenue">
                    {numero(c.secciones.length)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-texto-tenue">
                    {numero(c.casillas)}
                  </td>
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        void eliminar(c)
                      }}
                      className="inline-flex rounded p-1.5 text-texto-tenue hover:text-red-600"
                      title="Eliminar capturista"
                    >
                      <Trash2 size={15} />
                    </button>
                    <Link
                      to={`/capturistas/${c.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex rounded p-1.5 text-texto-tenue hover:text-primario"
                      title="Editar y asignar secciones"
                    >
                      <Pencil size={15} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Columna derecha: teléfonos y secciones del seleccionado */}
        <div className="space-y-4">
        <div className="rounded-xl border border-borde bg-superficie p-4">
          <h2 className="mb-1 text-sm font-semibold text-texto">Teléfonos</h2>
          {!elegido ? (
            <p className="mt-2 text-xs text-texto-tenue">
              Elige un capturista de la lista para ver sus teléfonos y generar un código.
            </p>
          ) : (
            <>
              <p className="mb-3 truncate text-xs text-texto-tenue">{elegido.nombre}</p>

              <button
                onClick={() => void generarCodigo()}
                className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-primario px-3 py-2 text-sm font-medium text-primario"
              >
                <KeyRound size={15} />
                Generar código
              </button>

              {telefonos.length === 0 && (
                <p className="text-xs text-texto-tenue">Ningún teléfono enrolado.</p>
              )}

              <ul className="space-y-2">
                {telefonos.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-texto">
                      <Smartphone size={14} className="shrink-0 text-texto-tenue" />
                      <span className="truncate">{t.nombre ?? 'Teléfono'}</span>
                      {/* Tres estados, no dos: un teléfono dado de baja conserva
                          su pase y sin mirar «activo» seguía pareciendo
                          enrolado después de desactivarlo. */}
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                          !t.activo
                            ? 'bg-fondo-alt text-texto-tenue'
                            : t.enrolado
                              ? 'bg-primario/10 text-primario'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {!t.activo ? 'desactivado' : t.enrolado ? 'enrolado' : 'sin enrolar'}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => void reemitir(t.id)}
                        className="rounded p-1.5 text-texto-tenue hover:text-primario"
                        title="Reemitir código"
                      >
                        <KeyRound size={14} />
                      </button>
                      {t.activo && (
                        <button
                          onClick={() => void desactivar(t.id)}
                          className="rounded p-1.5 text-texto-tenue hover:text-red-600"
                          title="Desactivar"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              {codigo && (
                <div className="mt-3 rounded-lg border border-primario/40 bg-primario/10 p-3">
                  <p className="text-xs text-texto-tenue">
                    Código · se muestra una sola vez
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
            </>
          )}
        </div>

        {/* Secciones del seleccionado.

            Va aquí, junto a los teléfonos, porque son las dos cosas que se
            revisan al preparar a una persona: qué cubre y desde qué aparatos.
            Editar es un enlace a la pantalla propia, donde hay espacio. */}
        <div className="rounded-xl border border-borde bg-superficie p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-texto">Secciones</h2>
            {elegido && (
              <Link
                to={`/capturistas/${elegido.id}`}
                className="text-xs text-primario hover:underline"
              >
                Editar
              </Link>
            )}
          </div>

          {!elegido ? (
            <p className="text-xs text-texto-tenue">
              Elige un capturista para ver sus secciones.
            </p>
          ) : elegido.secciones.length === 0 ? (
            <p className="text-xs text-texto-tenue">
              Sin secciones asignadas.
            </p>
          ) : (
            <>
              <p className="mb-2 text-xs text-texto-tenue">
                {elegido.secciones.length} secciones ·{' '}
                {numero(elegido.secciones.reduce((t, s) => t + s.casillas, 0))} casillas
              </p>
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {elegido.secciones.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-fondo-alt"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="font-mono text-xs text-texto">{s.clave}</span>
                      <span className="truncate text-xs text-texto-tenue">
                        {s.municipio}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-texto-tenue">
                      {s.casillas}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}
/** Quita acentos y baja a minúsculas, para comparar nombres al buscar. */
function sinAcentos(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}