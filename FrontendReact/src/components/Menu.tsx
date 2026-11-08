import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { MENU } from '../utils/menu'
import { NOMBRE_SISTEMA, DESCRIPCION_SISTEMA } from '../utils/tema'
import type { ElementoMenu } from '../types'

const CLAVE_ABIERTOS = 'sirve-menu-abiertos'

interface Props {
  colapsado: boolean
  onAlternar: () => void
}

/**
 * Menú lateral multinivel.
 *
 * Los grupos se abren y se cierran, y el estado se recuerda entre sesiones.
 * El grupo que contiene la ruta activa se abre solo, para que al recargar no
 * aparezca cerrado.
 */
export function Menu({ colapsado, onAlternar }: Props) {
  const { pathname } = useLocation()

  const [abiertos, setAbiertos] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_ABIERTOS) ?? '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    const grupo = MENU.find((item) => item.hijos?.some((h) => h.ruta === pathname))
    if (grupo && !abiertos.includes(grupo.id)) {
      setAbiertos((prev) => [...prev, grupo.id])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    localStorage.setItem(CLAVE_ABIERTOS, JSON.stringify(abiertos))
  }, [abiertos])

  const alternarGrupo = (id: string) =>
    setAbiertos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const clasesEnlace = (activo: boolean) =>
    [
      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
      activo
        ? 'bg-primario-suave text-primario-texto font-medium'
        : 'text-texto-tenue hover:bg-fondo-alt hover:text-texto',
    ].join(' ')

  const pintarElemento = (item: ElementoMenu) => {
    const Icono = item.icono
    const tieneHijos = !!item.hijos?.length
    const abierto = abiertos.includes(item.id)
    const activoHijo = item.hijos?.some((h) => h.ruta === pathname) ?? false

    if (tieneHijos) {
      return (
        <li key={item.id}>
          <button
            onClick={() => alternarGrupo(item.id)}
            title={colapsado ? item.etiqueta : undefined}
            className={[
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              activoHijo
                ? 'text-primario-texto font-medium'
                : 'text-texto-tenue hover:bg-fondo-alt hover:text-texto',
            ].join(' ')}
          >
            <Icono size={18} className="shrink-0" />
            {!colapsado && (
              <>
                <span className="flex-1 text-left">{item.etiqueta}</span>
                <ChevronDown
                  size={15}
                  className={`shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`}
                />
              </>
            )}
          </button>

          {!colapsado && abierto && (
            <ul className="mt-1 ml-4 space-y-1 border-l border-borde pl-3">
              {item.hijos!.map((hijo) => {
                const IconoHijo = hijo.icono
                return (
                  <li key={hijo.id}>
                    <NavLink to={hijo.ruta!} end className={({ isActive }) => clasesEnlace(isActive)}>
                      <IconoHijo size={16} className="shrink-0" />
                      <span>{hijo.etiqueta}</span>
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          )}
        </li>
      )
    }

    return (
      <li key={item.id}>
        <NavLink
          to={item.ruta!}
          end
          title={colapsado ? item.etiqueta : undefined}
          className={({ isActive }) => clasesEnlace(isActive)}
        >
          <Icono size={18} className="shrink-0" />
          {!colapsado && <span>{item.etiqueta}</span>}
        </NavLink>
      </li>
    )
  }

  return (
    <aside
      className={[
        'flex h-full flex-col border-r border-borde bg-superficie transition-[width] duration-200',
        colapsado ? 'w-[68px]' : 'w-64',
      ].join(' ')}
    >
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primario font-semibold text-white">
          S
        </div>
        {!colapsado && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-texto">{NOMBRE_SISTEMA}</p>
            <p className="truncate text-xs text-texto-tenue">{DESCRIPCION_SISTEMA}</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        <ul className="space-y-1">{MENU.map(pintarElemento)}</ul>
      </nav>

      <button
        onClick={onAlternar}
        className="flex items-center gap-3 border-t border-borde px-4 py-3 text-sm text-texto-tenue hover:text-texto"
        title={colapsado ? 'Expandir menú' : 'Colapsar menú'}
      >
        {colapsado ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        {!colapsado && <span>Colapsar</span>}
      </button>
    </aside>
  )
}