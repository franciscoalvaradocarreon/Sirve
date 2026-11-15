import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { cliente } from '../api/cliente'

/**
 * Imagen del acta.
 *
 * No se puede usar `<img src="/api/actas/…">` a secas: esa ruta pide el token
 * en una cabecera, y una etiqueta img no manda cabeceras. El servidor
 * respondía 401 y el navegador dibujaba el icono de imagen rota.
 *
 * Aquí se descarga con el cliente de siempre —que sí lleva el token— y se
 * convierte en una dirección temporal del navegador. Las imágenes ya
 * descargadas se guardan en memoria para no pedirlas dos veces al moverse
 * entre miniaturas y la vista grande.
 */

/** Direcciones ya descargadas, por casilla y elección. */
const descargadas = new Map<string, string>()

/** Tope de imágenes guardadas; al pasar, se suelta la más vieja. */
const MAXIMO = 150

const llave = (idCasilla: number, idEleccion: number) => `${idCasilla}:${idEleccion}`

function descargar(idCasilla: number, idEleccion: number): Promise<string> {
  const clave = llave(idCasilla, idEleccion)

  const guardada = descargadas.get(clave)
  if (guardada) return Promise.resolve(guardada)

  return cliente
    .get<Blob>(`/actas/${idCasilla}/${idEleccion}/imagen`, {
      responseType: 'blob',
      timeout: 30000,
    })
    .then((r) => {
      const url = URL.createObjectURL(r.data)

      // Si se llenó, se suelta la más antigua: sin esto, recorrer seis mil
      // actas dejaría seis mil imágenes en memoria.
      if (descargadas.size >= MAXIMO) {
        const [vieja, urlVieja] = descargadas.entries().next().value as [string, string]
        URL.revokeObjectURL(urlVieja)
        descargadas.delete(vieja)
      }

      descargadas.set(clave, url)
      return url
    })
}

/** Devuelve una dirección utilizable de la imagen del acta. */
export async function urlDeActa(idCasilla: number, idEleccion: number): Promise<string> {
  return descargar(idCasilla, idEleccion)
}

interface Props {
  idCasilla: number
  idEleccion: number
  alt: string
  className?: string
}

export function ActaImagen({ idCasilla, idEleccion, alt, className }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    let vigente = true
    setFallo(false)
    setUrl(null)

    descargar(idCasilla, idEleccion)
      .then((u) => {
        if (vigente) setUrl(u)
      })
      .catch(() => {
        if (vigente) setFallo(true)
      })

    return () => {
      // La dirección no se libera aquí: puede seguir en uso por otra vista.
      vigente = false
    }
  }, [idCasilla, idEleccion])

  if (fallo) {
    return (
      <div
        className={`flex items-center justify-center bg-fondo-alt text-texto-tenue ${className ?? ''}`}
        title="No se pudo cargar la imagen"
      >
        <ImageOff size={20} />
      </div>
    )
  }

  if (!url) {
    return <div className={`animate-pulse bg-fondo-alt ${className ?? ''}`} />
  }

  return <img src={url} alt={alt} className={className} loading="lazy" />
}
