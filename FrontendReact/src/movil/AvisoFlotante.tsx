import { useEffect, useRef } from 'react'
import { Check, CloudOff, Info, TriangleAlert } from 'lucide-react'

/**
 * Aviso flotante, al centro de la pantalla, que se va solo.
 *
 * Se usa para todo: confirmaciones, avisos sin conexión y errores. Dura un
 * segundo y desaparece, así que no roba espacio ni obliga a cerrarlo.
 *
 * Consecuencia a tener presente: un mensaje largo —«no se pudo descargar:
 * casillas de Diputaciones»— apenas alcanza a leerse en ese segundo. Para
 * errores que exigen corrección conviene subir `duracionMs` en la llamada.
 */
export function AvisoFlotante({
  tipo,
  texto,
  alCerrar,
  duracionMs = 1000,
}: {
  tipo: 'ok' | 'cola' | 'info' | 'error'
  texto: string
  alCerrar: () => void
  duracionMs?: number
}) {
  // La función de cierre se guarda en una referencia para que el temporizador
  // no se reinicie cada vez que la pantalla se vuelve a dibujar: si no, un
  // aviso podría quedarse más tiempo del previsto.
  const cerrar = useRef(alCerrar)
  useEffect(() => {
    cerrar.current = alCerrar
  })

  useEffect(() => {
    const temporizador = window.setTimeout(() => cerrar.current(), duracionMs)
    return () => window.clearTimeout(temporizador)
  }, [texto, duracionMs])

  const estilos = {
    ok: 'bg-primario text-white',
    cola: 'bg-amber-500 text-white dark:bg-amber-600',
    info: 'bg-amber-500 text-white dark:bg-amber-600',
    error: 'bg-red-600 text-white dark:bg-red-700',
  }[tipo]

  const Icono = {
    ok: Check,
    cola: CloudOff,
    info: Info,
    error: TriangleAlert,
  }[tipo]

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-6"
    >
      <div
        className={`animate-aparecer flex max-w-full items-center gap-2.5 rounded-xl px-5 py-3.5 shadow-lg ${estilos}`}
      >
        <Icono size={18} className="shrink-0" />
        <span className="text-sm font-medium">{texto}</span>
      </div>
    </div>
  )
}
