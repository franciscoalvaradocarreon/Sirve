import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, History } from 'lucide-react'
import { historialServicio, type CambioHistorial } from '../api/historialServicio'
import { municipioServicio } from '../api/municipioServicio'
import { procesoServicio } from '../api/procesoServicio'
import type { Eleccion, Municipio, Proceso } from '../types'

/**
 * Historial de capturas.
 *
 * Responde a una pregunta de auditoría: quién capturó, quién reemplazó, desde
 * dónde, y qué decía el acta antes. La traza la escribe un trigger en la base,
 * así que aquí no hay nada que registrar: solo se lee.
 *
 * El renglón se puede abrir para ver las cuatro cifras completas. Cerrado
 * muestra el total, que es la que se compara de un vistazo.
 */
export function HistorialCaptura() {
  const [parametros, setParametros] = useSearchParams()

  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [elecciones, setElecciones] = useState<Eleccion[]>([])
  const [municipios, setMunicipios] = useState<Municipio[]>([])
  const [filas, setFilas] = useState<CambioHistorial[]>([])
  const [resumen, setResumen] = useState({ total: 0, altas: 0, reemplazos: 0 })
  const [abiertos, setAbiertos] = useState<Set<number>>(new Set())
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const idProceso = Number(parametros.get('id_proceso')) || null
  const idEleccion = Number(parametros.get('id_eleccion')) || null
  const idMunicipio = Number(parametros.get('id_municipio')) || null
  const seccion = parametros.get('seccion') ?? ''
  const casilla = parametros.get('casilla') ?? ''

  const numero = (n: number | null | undefined) =>
    n === null || n === undefined ? '—' : n.toLocaleString('es-MX')

  const cambiar = useCallback(
    (clave: string, valor: string, limpiar: string[] = []) => {
      setParametros((prev) => {
        if (valor) prev.set(clave, valor)
        else prev.delete(clave)
        limpiar.forEach((k) => prev.delete(k))
        return prev
      })
    },
    [setParametros],
  )

  // Catálogos: procesos, y de ahí elecciones y municipios.
  useEffect(() => {
    procesoServicio
      .listar()
      .then((p) => {
        setProcesos(p)
        const activo = p.find((x) => x.activo) ?? p[0]
        if (activo && !idProceso) cambiar('id_proceso', String(activo.id))
      })
      .catch((e: Error) => setError(e.message))
  }, [cambiar, idProceso])

  useEffect(() => {
    if (!idProceso) return
    procesoServicio.elecciones(idProceso).then(setElecciones).catch(() => setElecciones([]))
    municipioServicio.listar(idProceso).then(setMunicipios).catch(() => setMunicipios([]))
  }, [idProceso])

  // La consulta: se repite cuando cambia cualquier filtro.
  useEffect(() => {
    if (!idProceso) return
    setCargando(true)
    setError(null)
    historialServicio
      .buscar({ idMunicipio, seccion, casilla, idEleccion, limite: 100 })
      .then((pagina) => {
        setFilas(pagina.filas)
        setResumen(pagina.resumen)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setCargando(false))
  }, [idProceso, idMunicipio, seccion, casilla, idEleccion])

  const visibles = useMemo(() => filas.slice(0, 100), [filas])

  const alternar = (id: number) =>
    setAbiertos((prev) => {
      const copia = new Set(prev)
      if (copia.has(id)) copia.delete(id)
      else copia.add(id)
      return copia
    })

  const cuando = (iso: string) =>
    new Date(iso).toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })

  const campo = 'rounded-lg border border-borde bg-superficie px-3 py-2 text-sm text-texto'

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-texto">Historial de capturas</h1>
        <p className="mt-1 text-sm text-texto-tenue">
          Quién capturó y quién reemplazó, con lo que decía el acta antes.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-texto-tenue">
          Proceso
          <select
            className={campo}
            value={idProceso ?? ''}
            onChange={(e) => cambiar('id_proceso', e.target.value, ['id_eleccion', 'id_municipio', 'seccion', 'casilla'])}
          >
            {procesos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.anio}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-texto-tenue">
          Elección
          <select
            className={campo}
            value={idEleccion ?? ''}
            onChange={(e) => cambiar('id_eleccion', e.target.value)}
          >
            <option value="">Todas</option>
            {elecciones.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-texto-tenue">
          Municipio
          <select
            className={campo}
            value={idMunicipio ?? ''}
            onChange={(e) => cambiar('id_municipio', e.target.value, ['seccion', 'casilla'])}
          >
            <option value="">Todos</option>
            {municipios.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-texto-tenue">
          Sección
          <input
            className={`${campo} w-24 tabular-nums`}
            value={seccion}
            inputMode="numeric"
            placeholder="1474"
            onChange={(e) => cambiar('seccion', e.target.value.replace(/\D/g, ''), ['casilla'])}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-texto-tenue">
          Casilla
          <input
            className={`${campo} w-28`}
            value={casilla}
            placeholder="1723-B"
            onChange={(e) => cambiar('casilla', e.target.value.toUpperCase())}
          />
        </label>

        {(idMunicipio || seccion || casilla || idEleccion) && (
          <button
            type="button"
            onClick={() => cambiar('', '', ['id_municipio', 'seccion', 'casilla', 'id_eleccion'])}
            className="mb-1 text-xs text-texto-tenue underline-offset-2 hover:text-texto hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <p className="mb-3 flex flex-wrap items-baseline gap-x-3 text-xs text-texto-tenue">
        <span className="tabular-nums">
          {numero(resumen.total)} {resumen.total === 1 ? 'cambio' : 'cambios'}
        </span>
        <span className="tabular-nums">{numero(resumen.altas)} altas</span>
        <span className="tabular-nums">{numero(resumen.reemplazos)} reemplazos</span>
        {resumen.total > visibles.length && (
          <span className="text-texto-tenue/70">
            mostrando los {numero(visibles.length)} más recientes
          </span>
        )}
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {cargando && <p className="py-8 text-center text-sm text-texto-tenue">Cargando…</p>}

      {!cargando && visibles.length === 0 && (
        <div className="rounded-xl border border-borde bg-superficie p-10 text-center text-texto-tenue">
          <History size={22} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No hay cambios con estos filtros.</p>
          <p className="mt-1 text-xs opacity-70">
            La traza empieza a registrarse desde que se instalaron los triggers.
          </p>
        </div>
      )}

      {!cargando && visibles.length > 0 && (
        <ul className="overflow-hidden rounded-xl border border-borde bg-superficie">
          {visibles.map((fila) => {
            const abierto = abiertos.has(fila.id)
            const reemplazo = fila.accion === 'REEMPLAZAR'
            const cambioTotal =
              fila.antes_total !== null && fila.despues_total !== null && fila.antes_total !== fila.despues_total

            return (
              <li key={fila.id} className="border-b border-borde last:border-0">
                <button
                  type="button"
                  onClick={() => alternar(fila.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-fondo-alt"
                >
                  <span
                    aria-hidden
                    className={`mt-1 w-1 self-stretch rounded-full ${
                      reemplazo ? 'bg-primario' : 'bg-texto-tenue/30'
                    }`}
                  />
                  <span className="mt-0.5 text-texto-tenue">
                    {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="tabular-nums text-texto-tenue">{cuando(fila.ocurrido_en)}</span>
                      <span className={reemplazo ? 'font-medium text-primario-texto' : 'text-texto'}>
                        {reemplazo ? 'Reemplazo' : 'Alta'}
                      </span>
                      <span className="text-texto">
                        {fila.actor_login ??
                          (fila.actor_capturista ? `Capturista ${fila.actor_capturista}` : 'sin actor registrado')}
                      </span>
                      {fila.ip && <span className="font-mono text-xs text-texto-tenue">{fila.ip}</span>}
                    </span>

                    <span className="mt-1 block text-xs text-texto-tenue">
                      {fila.municipio} · sección {fila.seccion} · casilla {fila.casilla}
                    </span>

                    <span className="mt-1 flex flex-wrap items-baseline gap-x-3 text-xs tabular-nums">
                      <span className="text-texto-tenue">
                        total{' '}
                        <span className="text-texto">{numero(fila.antes_total)}</span>
                        <span aria-hidden className="mx-1 text-texto-tenue/60">
                          →
                        </span>
                        <span className={cambioTotal ? 'font-medium text-primario-texto' : 'text-texto'}>
                          {numero(fila.despues_total)}
                        </span>
                      </span>
                      {abierto && (
                        <>
                          <span className="text-texto-tenue">
                            suma {numero(fila.antes_suma)} → {numero(fila.despues_suma)}
                          </span>
                          <span className="text-texto-tenue">
                            nulos {numero(fila.antes_nulos)} → {numero(fila.despues_nulos)}
                          </span>
                          <span className="text-texto-tenue">votos {numero(fila.votos_antes)}</span>
                          {fila.agente && (
                            <span className="font-mono text-texto-tenue/70">{fila.agente}</span>
                          )}
                        </>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
