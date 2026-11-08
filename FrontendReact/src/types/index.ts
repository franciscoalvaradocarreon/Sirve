import type { LucideIcon } from 'lucide-react'

/** Proceso electoral. */
export interface Proceso {
  id: number
  anio: number
  nombre: string
  estado: string
  activo: boolean
  fecha_jornada: string | null
  entidad: string
}

/** Elección de un proceso, con sus conteos. */
export interface Eleccion {
  id: number
  clave: string
  nombre: string
  tipo: string
  orden: number
  activa: boolean
  casillas: number
  opciones: number
  capturadas: number
}

/** Municipio con secciones en un proceso. */
export interface Municipio {
  id: number
  clave: string
  nombre: string
  secciones: number
}

/** Distrito electoral: local o federal. */
export interface Distrito {
  id: number
  clave: string
  nombre: string
  tipo: string
  secciones: number
}

/** Sección con su número de casillas y sus distritos. */
export interface Seccion {
  id: number
  clave: string
  municipio: string
  casillas: number
  distrito_local: string | null
  distrito_federal: string | null
}

/** Casilla con su ubicación administrativa y su estado de captura. */
export interface Casilla {
  id: number
  clave: string
  tipo: string
  direccion: string | null
  ubicacion: string | null
  seccion: string
  municipio: string
  distrito_local: string | null
  distrito_federal: string | null
  capturada: boolean
  total_acta: number | null
  aritmetica_ok: boolean | null
}

/** Opción de la boleta. */
export interface OpcionBoleta {
  id: number
  etiqueta: string
  tipo: string
  orden: number
}

/** Captura guardada. */
export interface Captura {
  id: number
  id_casilla: number
  id_eleccion: number
  total_acta: number
  no_registrados: number
  nulos: number
  suma_opciones: number
  diferencia: number
  aritmetica_ok: boolean
  recibida_en: string
}

/** Un renglón del detalle de la captura. */
export interface Voto {
  id_opcion: number
  votos: number
}

/** Cuerpo para guardar o reemplazar una captura. */
export interface CapturaCrear {
  id_cliente: string
  id_casilla: number
  id_eleccion: number
  total_acta: number
  no_registrados: number
  nulos: number
  votos: Voto[]
  autor_texto?: string | null
}

/**
 * Elemento del menú.
 *
 * Misma forma que usa el SIH (label, path, icono, hijos), para que cuando el
 * menú venga de la base de datos el componente no cambie.
 */
export interface ElementoMenu {
  id: string
  etiqueta: string
  ruta?: string
  icono: LucideIcon
  hijos?: ElementoMenu[]
}

/** Error de la API con el formato del contrato. */
export interface ErrorContrato {
  codigo: string
  mensaje: string
  detalle?: string
}

/** Una fila del reporte de avance: un municipio o un distrito. */
export interface AvanceFila {
  id: number
  clave: string
  nombre: string
  casillas: number
  capturadas: number
}

/** Reporte de avance de una elección, con sus totales. */
export interface AvanceResumen {
  agrupacion: string
  casillas: number
  capturadas: number
  filas: AvanceFila[]
}

/** Cómo se agrupa el reporte de avance. */
export type AgrupacionAvance = 'municipio' | 'distrito_local' | 'distrito_federal'