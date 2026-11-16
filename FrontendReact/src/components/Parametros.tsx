import { useEffect, useState } from 'react'
import { Check, Save } from 'lucide-react'
import { cliente } from '../api/cliente'

interface Parametro {
  clave: string
  valor: string
  descripcion: string | null
}

/**
 * Parámetros de la aplicación.
 *
 * Son los ajustes que cambian sin desplegar. El más importante es el
 * interruptor de la sala: encenderla a las seis de la tarde no puede depender
 * de entrar al servidor y reiniciar un contenedor.
 *
 * Cada cambio se guarda solo, contra el servidor, y se confirma con un visto.
 */
export function Parametros() {
  const [valores, setValores] = useState<Record<string, string>>({})
  const [descripciones, setDescripciones] = useState<Record<string, string>>({})
  const [guardado, setGuardado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cliente
      .get<Parametro[]>('/parametros')
      .then((r) => {
        const v: Record<string, string> = {}
        const d: Record<string, string> = {}
        r.data.forEach((p) => {
          v[p.clave] = p.valor
          if (p.descripcion) d[p.clave] = p.descripcion
        })
        setValores(v)
        setDescripciones(d)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar'))
      .finally(() => setCargando(false))
  }, [])

  async function guardar(clave: string, valor: string) {
    setError(null)
    try {
      await cliente.put(`/parametros/${clave}`, { valor })
      setValores((prev) => ({ ...prev, [clave]: valor }))
      setGuardado(clave)
      window.setTimeout(() => setGuardado(null), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    }
  }

  if (cargando) return <p className="p-6 text-sm text-texto-tenue">Cargando…</p>

  const sala = valores['sala.habilitada'] === 'true'

  const campo =
    'w-28 rounded-lg border border-borde bg-superficie px-3 py-1.5 text-sm text-texto'

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-texto">Parámetros</h1>
        <p className="mt-1 text-sm text-texto-tenue">
          Ajustes que se cambian sin desplegar. Cada uno se guarda al instante.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Sala de resultados */}
      <section className="mb-4 rounded-xl border border-borde bg-superficie p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-texto">Sala de resultados</h2>
            <p className="mt-1 text-xs text-texto-tenue">
              {descripciones['sala.habilitada'] ?? 'Publica los resultados en /sala.'}
            </p>
          </div>

          <button
            onClick={() => void guardar('sala.habilitada', sala ? 'false' : 'true')}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
              sala ? 'bg-primario text-white' : 'border border-borde text-texto-tenue'
            }`}
          >
            <span
              className={`h-3 w-3 rounded-full ${sala ? 'bg-white' : 'bg-texto-tenue/40'}`}
            />
            {sala ? 'Encendida' : 'Apagada'}
            {guardado === 'sala.habilitada' && <Check size={14} />}
          </button>
        </div>

        <p className="mt-3 text-xs text-texto-tenue">
          {sala
            ? 'La sala está publicando cifras ahora mismo en /sala.'
            : 'La página existe, pero no muestra cifras hasta que la enciendas.'}
        </p>

        <label className="mt-4 block text-xs text-texto-tenue">
          Mensaje mientras está apagada
          <div className="mt-1 flex gap-2">
            <input
              value={valores['sala.mensaje'] ?? ''}
              onChange={(e) =>
                setValores((prev) => ({ ...prev, 'sala.mensaje': e.target.value }))
              }
              className="flex-1 rounded-lg border border-borde bg-superficie px-3 py-1.5 text-sm text-texto"
            />
            <button
              onClick={() => void guardar('sala.mensaje', valores['sala.mensaje'] ?? '')}
              className="rounded-lg border border-borde px-3 py-1.5 text-xs text-texto-tenue hover:text-primario"
            >
              {guardado === 'sala.mensaje' ? <Check size={14} /> : <Save size={14} />}
            </button>
          </div>
        </label>
      </section>

      {/* Enrolamiento */}
      <section className="mb-4 rounded-xl border border-borde bg-superficie p-5">
        <h2 className="text-sm font-semibold text-texto">Códigos de enrolamiento</h2>
        <p className="mt-1 text-xs text-texto-tenue">
          {descripciones['enrolamiento.horas'] ?? 'Cuántas horas vale un código.'}
        </p>

        <label className="mt-3 flex items-center gap-2 text-xs text-texto-tenue">
          Valen
          <input
            type="number"
            min={1}
            max={168}
            value={valores['enrolamiento.horas'] ?? '3'}
            onChange={(e) =>
              setValores((prev) => ({ ...prev, 'enrolamiento.horas': e.target.value }))
            }
            className={campo}
          />
          horas
          <button
            onClick={() =>
              void guardar('enrolamiento.horas', valores['enrolamiento.horas'] ?? '3')
            }
            className="rounded-lg border border-borde px-3 py-1.5 text-xs hover:text-primario"
          >
            {guardado === 'enrolamiento.horas' ? <Check size={14} /> : 'Guardar'}
          </button>
        </label>
      </section>

      {/* Aviso de disco */}
      <section className="mb-4 rounded-xl border border-borde bg-superficie p-5">
        <h2 className="text-sm font-semibold text-texto">Aviso de disco</h2>
        <p className="mt-1 text-xs text-texto-tenue">
          Si el disco se llena, la base deja de escribir y la captura se detiene sin avisar en
          pantalla. Aquí se decide cuándo empieza a avisar y a dónde manda el aviso.
        </p>

        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-2 text-xs text-texto-tenue">
            <span className="flex-1">Avisar cuando el disco pase de</span>
            <input
              type="number"
              min={50}
              max={99}
              value={valores['disco.umbral'] ?? '80'}
              onChange={(e) =>
                setValores((prev) => ({ ...prev, 'disco.umbral': e.target.value }))
              }
              className={campo}
            />
            %
            <button
              onClick={() => void guardar('disco.umbral', valores['disco.umbral'] ?? '80')}
              className="rounded-lg border border-borde px-3 py-1.5 hover:text-primario"
            >
              {guardado === 'disco.umbral' ? <Check size={14} /> : 'Guardar'}
            </button>
          </label>

          <label className="block text-xs text-texto-tenue">
            Dirección del webhook (bot de Telegram o servicio propio)
            <div className="mt-1 flex gap-2">
              <input
                value={valores['alerta.webhook'] ?? ''}
                onChange={(e) =>
                  setValores((prev) => ({ ...prev, 'alerta.webhook': e.target.value }))
                }
                placeholder="https://api.telegram.org/bot<token>/sendMessage"
                className="flex-1 rounded-lg border border-borde bg-superficie px-3 py-1.5 text-sm text-texto"
              />
              <button
                onClick={() =>
                  void guardar('alerta.webhook', valores['alerta.webhook'] ?? '')
                }
                className="rounded-lg border border-borde px-3 py-1.5 text-xs hover:text-primario"
              >
                {guardado === 'alerta.webhook' ? <Check size={14} /> : 'Guardar'}
              </button>
            </div>
            <span className="mt-1 block text-[11px] text-texto-tenue">
              Vacío: el aviso solo queda en el registro del servidor. El banner de la pantalla
              funciona aunque no haya webhook.
            </span>
          </label>

          <label className="flex items-center gap-2 text-xs text-texto-tenue">
            <span className="flex-1">Chat de Telegram (solo si es un bot)</span>
            <input
              value={valores['alerta.chat'] ?? ''}
              onChange={(e) =>
                setValores((prev) => ({ ...prev, 'alerta.chat': e.target.value }))
              }
              placeholder="-1001234567890"
              className="w-44 rounded-lg border border-borde bg-superficie px-3 py-1.5 text-sm text-texto"
            />
            <button
              onClick={() => void guardar('alerta.chat', valores['alerta.chat'] ?? '')}
              className="rounded-lg border border-borde px-3 py-1.5 hover:text-primario"
            >
              {guardado === 'alerta.chat' ? <Check size={14} /> : 'Guardar'}
            </button>
          </label>
        </div>
      </section>

      {/* Límites */}
      <section className="rounded-xl border border-borde bg-superficie p-5">
        <h2 className="text-sm font-semibold text-texto">Límites de peticiones</h2>
        <p className="mt-1 text-xs text-texto-tenue">
          Por minuto. El de credencial es amplio a propósito: varios capturistas pueden
          compartir la IP de salida de una operadora.
        </p>

        <div className="mt-3 space-y-2">
          {[
            ['limite.credencial', 'Por sesión o teléfono'],
            ['limite.anonima', 'Por IP sin credencial'],
            ['limite.credenciales', 'Por IP en login y enrolamiento'],
          ].map(([clave, etiqueta]) => (
            <div key={clave} className="flex items-center gap-2 text-xs text-texto-tenue">
              <span className="flex-1">{etiqueta}</span>
              <input
                type="number"
                min={1}
                value={valores[clave] ?? ''}
                onChange={(e) => setValores((prev) => ({ ...prev, [clave]: e.target.value }))}
                className={campo}
              />
              <button
                onClick={() => void guardar(clave, valores[clave] ?? '')}
                className="rounded-lg border border-borde px-3 py-1.5 hover:text-primario"
              >
                {guardado === clave ? <Check size={14} /> : 'Guardar'}
              </button>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-4 text-xs text-texto-tenue">
        Los límites se aplican al siguiente arranque del servidor; el interruptor de la sala y
        el plazo de los códigos, al instante.
      </p>
    </div>
  )
}
