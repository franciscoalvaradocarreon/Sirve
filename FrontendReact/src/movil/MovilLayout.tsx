import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { ClipboardCheck, CloudOff, ListChecks } from 'lucide-react'
import { pedirPersistencia } from '../utils/almacenamiento'
import { cola } from '../utils/cola'
import { NOMBRE_SISTEMA } from '../utils/tema'
import {
  aplicarTextoGrande,
  guardarTextoGrande,
  leerTextoGrande,
} from '../utils/texto'
import { useProceso } from './ProcesoContext'
import { EnrolamientoMovil } from './EnrolamientoMovil'
import { guardarSesion, leerSesion } from '../utils/sesion'
import { cliente, EVENTO_SESION_EXPIRADA } from '../api/cliente'

/**
 * Armazón de las pantallas móviles.
 *
 * Es un árbol aparte del de escritorio: barra arriba, navegación abajo y nada
 * de menú lateral. Las pantallas de escritorio no se tocan.
 *
 * La barra superior avisa cuando no hay conexión y cuántas capturas esperan,
 * porque es el dato que importa en la casilla: si el aviso está en verde, todo
 * se envió; si no, queda algo en el teléfono.
 */
export function MovilLayout() {
  const [enLinea, setEnLinea] = useState(navigator.onLine)
  const [pendientes, setPendientes] = useState(0)
  const [textoGrande, setTextoGrande] = useState(leerTextoGrande())
  const [sesion, setSesion] = useState(leerSesion())
  const { proceso } = useProceso()

  const alternarTexto = () => {
    const nuevo = !textoGrande
    setTextoGrande(nuevo)
    aplicarTextoGrande(nuevo)
    guardarTextoGrande(nuevo)
  }

  // Al entrar se pide al navegador que no borre lo guardado: la cola de
  // capturas sin enviar vive ahí, y perderla en una casilla sería perder
  // trabajo hecho.
  useEffect(() => {
    void pedirPersistencia()
  }, [])

  useEffect(() => {
    const alCambiar = () => setEnLinea(navigator.onLine)
    window.addEventListener('online', alCambiar)
    window.addEventListener('offline', alCambiar)
    return () => {
      window.removeEventListener('online', alCambiar)
      window.removeEventListener('offline', alCambiar)
    }
  }, [])

  useEffect(() => {
    let vigente = true
    const revisar = () => {
      cola
        .contar()
        .then((n) => {
          if (vigente) setPendientes(n)
        })
        .catch(() => {})
    }
    revisar()
    const temporizador = window.setInterval(revisar, 5000)
    return () => {
      vigente = false
      window.clearInterval(temporizador)
    }
  }, [])

  const claseTab = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors ${
      isActive ? 'text-primario-texto' : 'text-texto-tenue'
    }`

  /*
   * Al arrancar se comprueba que el pase siga sirviendo.
   *
   * Un teléfono puede darse de baja desde la administración mientras la
   * aplicación sigue abierta; sin esta comprobación, la captura se mostraba
   * igual y los envíos fallaban sin decir por qué.
   */
  useEffect(() => {
    if (!sesion) return

    const alExpirar = () => setSesion(null)
    window.addEventListener(EVENTO_SESION_EXPIRADA, alExpirar)

    cliente
      .get<{ nombre: string }>('/sesion')
      .then((r) => {
        // El nombre se refresca: pudo cambiarse en la administración.
        if (r.data?.nombre && r.data.nombre !== sesion.nombre) {
          guardarSesion({ pase: sesion.pase, nombre: r.data.nombre })
          setSesion({ pase: sesion.pase, nombre: r.data.nombre })
        }
      })
      .catch(() => {
        // El 401 ya limpió la sesión desde el interceptor; sin red se sigue
        // con lo guardado, que es justo lo que permite capturar sin señal.
      })

    return () => window.removeEventListener(EVENTO_SESION_EXPIRADA, alExpirar)
  }, [sesion])

  /*
   * Sin pase no hay aplicación: lo primero es enlazar el teléfono. Es lo
   * único que se pide, una sola vez, y sustituye a cualquier inicio de sesión.
   */
  if (!sesion) {
    return (
      <div className="min-h-dvh bg-fondo">
        <EnrolamientoMovil alEnrolar={() => setSesion(leerSesion())} />
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-fondo">
      <header className="sticky top-0 z-10 border-b border-borde bg-superficie">
        <div className="flex items-center gap-2 px-4 py-2">
          {/* Un solo renglón: sistema, quién captura, en qué proceso, conexión y
              tamaño de letra. La cabecera baja de 89px a 43, y esos 46px vuelven
              a la boleta. */}
          <p className="shrink-0 text-sm font-semibold text-texto">{NOMBRE_SISTEMA}</p>

          {sesion?.nombre && (
            <span
              className="min-w-0 truncate rounded-md border border-primario-texto/30 bg-primario/10 px-2 py-0.5 text-xs font-medium text-primario-texto"
              title={sesion.nombre}
            >
              {sesion.nombre}
            </span>
          )}

          {proceso && (
            <span className="shrink-0 rounded-md border border-borde px-2 py-0.5 text-xs text-texto-tenue">
              Proceso {proceso.anio}
            </span>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {enLinea ? (
              <span
                className={`rounded-full px-2.5 py-1 text-xs ${
                  pendientes === 0
                    ? 'bg-primario/10 text-primario-texto'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                {pendientes === 0 ? 'Al día' : `${pendientes} por enviar`}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                <CloudOff size={16} />
                Sin conexión
              </span>
            )}

            {/* Tamaño de letra. Es lo que más ayuda cuando no se ve bien de
                cerca: sube todo, no solo los números. */}
            <button
              onClick={alternarTexto}
              aria-pressed={textoGrande}
              title={textoGrande ? 'Volver al tamaño normal' : 'Agrandar la letra'}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                textoGrande
                  ? 'border-primario-texto bg-primario-texto text-white'
                  : 'border-borde text-texto-tenue'
              }`}
            >
              {textoGrande ? 'A−' : 'A+'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <nav className="sticky bottom-0 flex border-t border-borde bg-superficie pb-[env(safe-area-inset-bottom)]">
        <NavLink to="/movil" end className={claseTab}>
          <ClipboardCheck size={20} />
          Capturar
        </NavLink>
        <NavLink to="/movil/pendientes" className={claseTab}>
          <ListChecks size={20} />
          Pendientes{pendientes > 0 ? ` (${pendientes})` : ''}
        </NavLink>
      </nav>
    </div>
  )
}
