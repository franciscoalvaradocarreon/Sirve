import {
  Home,
  FolderTree,
  Vote,
  Users,
  MapPin,
  Map,
  Layers,
  LayoutGrid,
  ClipboardCheck,
  ListChecks,
  BarChart3,
} from 'lucide-react'
import type { ElementoMenu } from '../types'

/**
 * Menú de la aplicación.
 *
 * Estático por ahora. Cuando exista autenticación vendrá de la base de datos,
 * como en el SIH; la forma del tipo ya es la misma, así que solo cambiará de
 * dónde se lee.
 */
export const MENU: ElementoMenu[] = [
  { id: 'inicio', etiqueta: 'Inicio', ruta: '/', icono: Home },
  {
    id: 'catalogos',
    etiqueta: 'Catálogos',
    icono: FolderTree,
    hijos: [
      { id: 'procesos', etiqueta: 'Procesos', ruta: '/catalogos/procesos', icono: Vote },
      { id: 'elecciones', etiqueta: 'Elecciones', ruta: '/catalogos/elecciones', icono: ListChecks },
      { id: 'municipios', etiqueta: 'Municipios', ruta: '/catalogos/municipios', icono: MapPin },
      { id: 'distritos', etiqueta: 'Distritos', ruta: '/catalogos/distritos', icono: Map },
      { id: 'secciones', etiqueta: 'Secciones', ruta: '/catalogos/secciones', icono: Layers },
      { id: 'casillas', etiqueta: 'Casillas', ruta: '/catalogos/casillas', icono: LayoutGrid },
    ],
  },
  {
    id: 'captura',
    etiqueta: 'Captura',
    icono: ClipboardCheck,
    hijos: [
      { id: 'captura-nueva', etiqueta: 'Capturar casilla', ruta: '/captura', icono: ClipboardCheck },
      { id: 'captura-consulta', etiqueta: 'Consultar', ruta: '/captura/consulta', icono: ListChecks },
    ],
  },
  {
    id: 'operacion',
    etiqueta: 'Operación',
    icono: Users,
    hijos: [
      { id: 'capturistas', etiqueta: 'Capturistas', ruta: '/capturistas', icono: Users },
    ],
  },
  {
    id: 'reportes',
    etiqueta: 'Reportes',
    icono: BarChart3,
    hijos: [
      { id: 'reportes-avance', etiqueta: 'Avance', ruta: '/reportes/avance', icono: BarChart3 },
    ],
  },
]