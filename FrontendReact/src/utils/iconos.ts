import {
  Home, Library, Calendar, Vote, MapPin, Map, Hash, PencilLine, ClipboardList,
  ListChecks, Users, UserCog, ShieldCheck, BarChart3, ChartColumn, ListTree,
  Images, Circle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Traduce el nombre del icono que guarda la base al componente real.
 *
 * El menú vive en la base, así que no puede guardar código: guarda el nombre.
 * Si el nombre no existe se usa un círculo, para que un menú mal escrito no
 * rompa la pantalla entera.
 */
const ICONOS: Record<string, LucideIcon> = {
  Home, Library, Calendar, Vote, MapPin, Map, Hash, PencilLine, ClipboardList,
  ListChecks, Users, UserCog, ShieldCheck, BarChart3, ChartColumn, ListTree, Images,
}

export const iconoPorNombre = (nombre: string | null): LucideIcon =>
  (nombre && ICONOS[nombre]) || Circle