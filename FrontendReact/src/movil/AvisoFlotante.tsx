import { useEffect, useRef } from 'react'
import { Check, CloudOff } from 'lucide-react'

/**
 * Aviso flotante, al centro de la pantalla, que se va solo.
 *
 * Se usa para confirmar lo que acaba de pasar —se guardó, quedó en el
 * teléfono— sin robarle espacio a la captura ni dejarlo ahí para siempre.
 *
 * Los errores NO usan esto: un mensaje que desaparece en un segundo no se
 * alcanza a leer cuando hay que hacer algo al respecto. Para esos queda la
 * franja fija de arriba.
 */
export function AvisoFlotante({
  tipo,
  texto,
  alCerrar,
  duracionMs = 1000,
}: {
  tipo: 'ok' | 'cola'
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

  const esExito = tipo === 'ok'

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-6"
    >
      <div
        className={`animate-aparecer flex items-center gap-2.5 rounded-xl px-5 py-3.5 shadow-lg ${
          esExito
            ? 'bg-primario text-white'
            : 'bg-amber-500 text-white dark:bg-amber-600'
        }`}
      >
        {esExito ? <Check size={18} /> : <CloudOff size={18} />}
        <span className="text-sm font-medium">{texto}</span>
      </div>
    </div>
  )
}
