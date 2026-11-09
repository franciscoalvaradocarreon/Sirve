import { useCallback, useEffect, useState } from 'react'
import { Check, HardDrive, RefreshCw, Trash2, TriangleAlert } from 'lucide-react'
import { ErrorApi } from '../api/cliente'
import { capturaServicio } from '../api/capturaServicio'
import { cola, type CapturaEnCola } from '../utils/cola'
import { estadoAlmacenamiento, formatearBytes, pedirPersistencia } from '../utils/almacenamiento'

/**
 * Capturas guardadas en el teléfono, esperando señal.
 *
 * El envío se reintenta al abrir la pantalla y al pulsar el botón. Las capturas
 * se van borrando conforme el servidor las acepta; las que devuelven un error
 * del servidor —no de red— se quedan con el mensaje a la vista, porque
 * reintentarlas sin más no las va a arreglar.
 */
export function MovilPendientes() {
  const [filas, setFilas] = useState<CapturaEnCola[]>([])
  const [enviando, setEnviando] = useState(false)
  const [resumen, setResumen] = useState<string | null>(null)
  const [almacen, setAlmacen] = useState<{ persistente: boolean; uso: number } | null>(null)

  const cargar = useCallback(() => {
    cola.listar().then(setFilas).catch(() => setFilas([]))
  }, [])

  const enviar = useCallback(async () => {
    const pendientes = await cola.listar()
    if (pendientes.length === 0) {
      setResumen('No hay nada pendiente.')
      return
    }
    setEnviando(true)
    setResumen(null)
    let enviadas = 0
    let fallidas = 0

    for (const fila of pendientes) {
      try {
        await capturaServicio.guardar(fila.datos)
        await cola.eliminar(fila.id_cliente)
        enviadas += 1
      } catch (e) {
        fallidas += 1
        if (e instanceof ErrorApi && e.estado === 0) {
          // Sigue sin haber red: no tiene caso seguir intentando.
          break
        }
        await cola.marcarError(
          fila.id_cliente,
          e instanceof Error ? e.message : 'El servidor rechazó la captura',
        )
      }
    }

    await cargar()
    setEnviando(false)
    setResumen(
      fallidas === 0
        ? `${enviadas} ${enviadas === 1 ? 'captura enviada' : 'capturas enviadas'}.`
        : `${enviadas} enviadas, ${fallidas} con problema.`,
    )
  }, [cargar])

  useEffect(() => {
    // Si el navegador no había concedido la persistencia, se vuelve a pedir:
    // es más probable que la conceda con la aplicación ya instalada.
    void pedirPersistencia().then(() =>
      estadoAlmacenamiento().then((e) =>
        setAlmacen(e ? { persistente: e.persistente, uso: e.uso } : null),
      ),
    )
  }, [])

  useEffect(() => {
    cargar()
    // Al entrar con red, se intenta enviar solo.
    if (navigator.onLine) void enviar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const alVolver = () => {
      if (navigator.onLine) void enviar()
    }
    window.addEventListener('online', alVolver)
    return () => window.removeEventListener('online', alVolver)
  }, [enviar])

  const fecha = (ms: number) =>
    new Date(ms).toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-texto">Pendientes</h1>
          <p className="text-xs text-texto-tenue">
            {filas.length === 0
              ? 'Todo lo capturado en este teléfono ya se envió.'
              : `${filas.length} en espera de conexión`}
          </p>
        </div>
        <button
          onClick={() => void enviar()}
          disabled={enviando || filas.length === 0}
          className="flex items-center gap-2 rounded-lg bg-primario px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          <RefreshCw size={15} className={enviando ? 'animate-spin' : ''} />
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </div>

      {resumen && (
        <div className="mb-4 rounded-lg border border-borde bg-superficie p-3 text-sm text-texto">
          {resumen}
        </div>
      )}

      {almacen && (
        <p
          className={`mb-4 flex items-center gap-1.5 text-xs ${
            almacen.persistente ? 'text-texto-tenue' : 'text-amber-700 dark:text-amber-400'
          }`}
        >
          <HardDrive size={13} className="shrink-0" />
          {almacen.persistente
            ? `Guardado protegido · ${formatearBytes(almacen.uso)} en este teléfono`
            : `El teléfono podría borrar estos datos · ${formatearBytes(almacen.uso)}`}
        </p>
      )}

      {filas.length === 0 ? (
        <div className="rounded-xl border border-borde bg-superficie p-8 text-center">
          <Check size={24} className="mx-auto mb-2 text-primario" />
          <p className="text-sm text-texto-tenue">Nada pendiente.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filas.map((f) => (
            <li key={f.id_cliente} className="rounded-xl border border-borde bg-superficie p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-texto">{f.casilla}</p>
                  <p className="truncate text-xs text-texto-tenue">{f.eleccion}</p>
                  <p className="mt-1 text-xs text-texto-tenue">
                    {fecha(f.creado)} · acta {f.datos.total_acta}
                    {f.intentos > 0 && ` · ${f.intentos} intento(s)`}
                  </p>
                  {f.error && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-red-700 dark:text-red-400">
                      <TriangleAlert size={13} className="mt-0.5 shrink-0" />
                      {f.error}
                    </p>
                  )}
                </div>
                <button
                  onClick={async () => {
                    await cola.eliminar(f.id_cliente)
                    cargar()
                  }}
                  className="shrink-0 rounded-lg p-2 text-texto-tenue hover:text-red-600"
                  title="Descartar"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
