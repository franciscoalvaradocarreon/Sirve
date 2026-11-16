import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Moon, Sun, TriangleAlert } from 'lucide-react'
import { Menu } from './Menu'
import { useTema } from '../context/TemaContext'
import { cliente } from '../api/cliente'

interface Disco {
  porcentaje: number
  libreLegible: string
  totalLegible: string
  umbral: number
  alerta: boolean
  aviso: string | null
}

/**
 * Armazón de la aplicación: menú a la izquierda, contenido a la derecha y una
 * barra superior con el conmutador de tema.
 *
 * Arriba del contenido va el aviso de disco. Si el disco se llena, PostgreSQL
 * deja de escribir y la captura se detiene sin decir por qué; verlo en pantalla
 * es la diferencia entre actuar a tiempo y descubrirlo con los capturistas
 * esperando.
 */
export function Layout() {
  const { tema, alternar } = useTema()
  const [colapsado, setColapsado] = useState(
    () => localStorage.getItem('sirve-menu-colapsado') === 'si',
  )
  const [disco, setDisco] = useState<Disco | null>(null)

  useEffect(() => {
    localStorage.setItem('sirve-menu-colapsado', colapsado ? 'si' : 'no')
  }, [colapsado])

  // Se consulta cada cinco minutos: el disco no cambia de un minuto a otro.
  useEffect(() => {
    let vigente = true

    const revisar = () =>
      cliente
        .get<Disco>('/salud/disco', { timeout: 10000 })
        .then((r) => {
          if (vigente) setDisco(r.data)
        })
        .catch(() => {
          // Sin dato no se muestra nada: no vale la pena alarmar por un fallo
          // de consulta.
        })

    void revisar()
    const temporizador = window.setInterval(() => void revisar(), 5 * 60 * 1000)
    return () => {
      vigente = false
      window.clearInterval(temporizador)
    }
  }, [])

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

        {disco?.alerta && (
          <div
            className="flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-6 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
            role="alert"
          >
            <TriangleAlert size={16} className="shrink-0" />
            <span>
              <strong>Disco al {disco.porcentaje} %.</strong> Quedan {disco.libreLegible} de{' '}
              {disco.totalLegible}. Si se llena, la captura deja de guardar.
            </span>
          </div>
        )}

        <main className="min-w-0 flex-1 overflow-y-auto bg-fondo p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
