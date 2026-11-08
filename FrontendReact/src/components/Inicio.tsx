import { NOMBRE_SISTEMA } from '../utils/tema'

/** Pantalla de entrada: dice qué es el sistema y por dónde empezar. */
export function Inicio() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold text-texto">{NOMBRE_SISTEMA}</h1>
      <p className="mt-2 text-sm text-texto-tenue">
        Captura y consulta de resultados electorales por casilla.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { titulo: 'Catálogos', detalle: 'Procesos, elecciones, secciones y casillas' },
          { titulo: 'Captura', detalle: 'Resultados por casilla, en el orden del acta' },
          { titulo: 'Reportes', detalle: 'Avance y votos por opción' },
        ].map((t) => (
          <div key={t.titulo} className="rounded-xl border border-borde bg-superficie p-4">
            <p className="text-sm font-medium text-texto">{t.titulo}</p>
            <p className="mt-1 text-xs text-texto-tenue">{t.detalle}</p>
          </div>
        ))}
      </div>
    </div>
  )
}