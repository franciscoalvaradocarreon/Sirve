/**
 * Color primario del sistema.
 *
 * Es el único lugar donde se define. Cambiar esta constante cambia toda la
 * interfaz: menú, botones, enlaces e indicadores. No hay que tocar una sola
 * clase de Tailwind.
 */
export const COLOR_PRIMARIO = '#2fb9a3' // menta

export const NOMBRE_SISTEMA = 'SIRVE'

export const DESCRIPCION_SISTEMA = 'Captura de resultados'

/**
 * Vuelca el color primario a la variable CSS.
 *
 * De esa variable se derivan las variantes en index.css con color-mix, así
 * que un solo valor produce toda la gama.
 */
export function aplicarTema(color: string = COLOR_PRIMARIO) {
  document.documentElement.style.setProperty('--primario', color)
}