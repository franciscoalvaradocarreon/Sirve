import { cliente } from './cliente'

/** Foto del acta: subida y consulta. */
export const fotoServicio = {
  /**
   * Sube la imagen.
   *
   * Se borra el Content-Type por omisión para que el navegador ponga el suyo,
   * con el límite («boundary») que necesita el formato multipart. Fijarlo a
   * mano rompe la subida.
   */
  subir: async (idCasilla: number, idEleccion: number, archivo: Blob): Promise<void> => {
    const datos = new FormData()
    datos.append('archivo', archivo, `acta-${idCasilla}-${idEleccion}.jpg`)
    await cliente.post(`/actas/${idCasilla}/${idEleccion}`, datos, {
      headers: { 'Content-Type': undefined },
      timeout: 60000,
    })
  },

  /** Si esa casilla ya tiene foto en el servidor. */
  existe: async (idCasilla: number, idEleccion: number): Promise<boolean> =>
    (
      await cliente.get<{ tiene: boolean }>(`/actas/${idCasilla}/${idEleccion}`, {
        timeout: 10000,
      })
    ).data.tiene,
}
