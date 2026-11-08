import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import { Menu } from './Menu'
import { useTema } from '../context/TemaContext'

/**
 * Armazón de la aplicación: menú a la izquierda, contenido a la derecha y una
 * barra superior con el conmutador de tema.
 */
export function Layout() {
  const { tema, alternar } = useTema()
  const [colapsado, setColapsado] = useState(
    () => localStorage.getItem('sirve-menu-colapsado') === 'si',
  )

  useEffect(() => {
    localStorage.setItem('sirve-menu-colapsado', colapsado ? 'si' : 'no')
  }, [colapsado])

  return (
    <div className="flex h-full">
      <Menu colapsado={colapsado} onAlternar={() => setColapsado((v) => !v)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-end gap-2 border-b border-borde bg-superficie px-6">
          <button
            onClick={alternar}
            className="rounded-lg p-2 text-texto-tenue transition-colors hover:bg-fondo-alt hover:text-texto"
            title={tema === 'oscuro' ? 'Modo claro' : 'Modo oscuro'}
            aria-label={tema === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {tema === 'oscuro' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto bg-fondo p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}