import { useMemo, useState } from 'react'
import { ExternalLink, Map, X } from 'lucide-react'
import type { Seccion } from '../types'

/**
 * El plano de una sección.
 *
 * Los polígonos son cartografía de INEGI, ya convertida a SVG: no se dibujan en
 * el navegador ni se piden a la base. Cada plano trae la sección resaltada, las
 * secciones vecinas, el municipio y los límites de distrito local y federal.
 *
 * Cuando la sección no tiene polígono —pasa en procesos viejos, cuya cartografía
 * ya cambió— se dice, en lugar de mostrar un hueco.
 */
export function PlanoSeccion({ seccion, alCerrar }: { seccion: Seccion; alCerrar: () => void }) {
  const [fallo, setFallo] = useState(false)
  const ruta = `/planos/${seccion.clave_municipio}/${seccion.clave}.svg`

  const datos = useMemo(
    () => [
      ['Municipio', seccion.municipio],
      ['Distrito local', seccion.distrito_local ?? '—'],
      ['Distrito federal', seccion.distrito_federal ?? '—'],
      ['Casillas', String(seccion.casillas)],
    ],
    [seccion],
  )

  return (
    <aside className="flex w-full shrink-0 flex-col rounded-xl border border-borde bg-superficie lg:w-96">
      <header className="flex items-start justify-between gap-3 border-b border-borde px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-texto-tenue">
            <Map size={12} />
            Plano de la sección
          </p>
          <h2 className="mt-1 truncate text-lg font-semibold text-texto">
            Sección {seccion.clave}
          </h2>
          <p className="truncate text-xs text-texto-tenue">{seccion.municipio}</p>
        </div>
        <button
          onClick={alCerrar}
          className="rounded-lg p-1.5 text-texto-tenue hover:bg-fondo-alt hover:text-texto"
          title="Cerrar el plano"
          aria-label="Cerrar el plano"
        >
          <X size={16} />
        </button>
      </header>

      <div className="p-4">
        {fallo ? (
          <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed border-borde bg-fondo p-6 text-center">
            <p className="text-sm text-texto">Esta sección no tiene plano</p>
            <p className="mt-1 text-xs text-texto-tenue">
              La cartografía de INEGI no incluye su polígono en este proceso.
            </p>
          </div>
        ) : (
          <a
            href={ruta}
            target="_blank"
            rel="noopener"
            className="group block overflow-hidden rounded-lg border border-borde bg-fondo"
            title="Abrir el plano en otra pestaña"
          >
            <img
              src={ruta}
              alt={`Plano de la sección ${seccion.clave} de ${seccion.municipio}`}
              className="h-56 w-full object-contain"
              loading="lazy"
              onError={() => setFallo(true)}
            />
            <span className="flex items-center justify-center gap-1.5 border-t border-borde py-1.5 text-[11px] text-texto-tenue group-hover:text-primario-texto">
              <ExternalLink size={11} />
              Ver completo
            </span>
          </a>
        )}

        <dl className="mt-4">
          {datos.map(([etiqueta, valor]) => (
            <div
              key={etiqueta}
              className="flex items-baseline justify-between border-b border-borde-tenue py-1.5 last:border-0"
            >
              <dt className="text-xs uppercase tracking-wide text-texto-tenue">{etiqueta}</dt>
              <dd className="text-sm tabular-nums text-texto">{valor}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-3 text-[11px] leading-relaxed text-texto-tenue">
          Polígono resaltado en guinda; las líneas punteadas son los distritos local (verde) y
          federal (guinda). Cartografía de INEGI.
        </p>
      </div>
    </aside>
  )
}
