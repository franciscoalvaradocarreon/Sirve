import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type Tema = 'claro' | 'oscuro'

interface ValorTema {
  tema: Tema
  alternar: () => void
}

const CLAVE = 'sirve-tema'

const TemaContexto = createContext<ValorTema | null>(null)

/** Preferencia guardada o, si no hay, la del sistema. */
function temaInicial(): Tema {
  const guardado = localStorage.getItem(CLAVE)
  if (guardado === 'claro' || guardado === 'oscuro') return guardado as Tema
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro'
}

/**
 * Modo claro u oscuro para toda la aplicación.
 *
 * La elección del usuario manda sobre la preferencia del sistema y se
 * conserva entre sesiones.
 */
export function TemaProveedor({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial)

  useEffect(() => {
    const raiz = document.documentElement
    raiz.classList.toggle('dark', tema === 'oscuro')
    raiz.style.colorScheme = tema === 'oscuro' ? 'dark' : 'light'
    localStorage.setItem(CLAVE, tema)
  }, [tema])

  const valor = useMemo<ValorTema>(
    () => ({ tema, alternar: () => setTema((t) => (t === 'oscuro' ? 'claro' : 'oscuro')) }),
    [tema],
  )

  return <TemaContexto.Provider value={valor}>{children}</TemaContexto.Provider>
}

export function useTema(): ValorTema {
  const valor = useContext(TemaContexto)
  if (!valor) throw new Error('useTema debe usarse dentro de TemaProveedor')
  return valor
}