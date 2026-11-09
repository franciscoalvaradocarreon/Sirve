import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Proceso } from '../types'

/**
 * Proceso con el que se está capturando.
 *
 * Vive en un contexto porque lo necesitan dos partes distintas: la pantalla de
 * captura es quien lo determina, y la barra superior —que se dibuja fuera— es
 * quien lo muestra. Pasarlo por props obligaría a que el armazón supiera de
 * catálogos, y repetir la consulta en los dos lados abriría la puerta a que
 * muestren procesos distintos.
 */
interface EstadoProceso {
  proceso: Proceso | null
  setProceso: (proceso: Proceso | null) => void
}

const Contexto = createContext<EstadoProceso | null>(null)

export function ProcesoProveedor({ children }: { children: ReactNode }) {
  const [proceso, setProceso] = useState<Proceso | null>(null)
  const valor = useMemo(() => ({ proceso, setProceso }), [proceso])
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useProceso(): EstadoProceso {
  const valor = useContext(Contexto)
  if (!valor) {
    throw new Error('useProceso se usó fuera de ProcesoProveedor')
  }
  return valor
}
