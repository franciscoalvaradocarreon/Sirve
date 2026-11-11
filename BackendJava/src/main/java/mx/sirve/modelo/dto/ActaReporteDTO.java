package mx.sirve.modelo.dto;

import java.time.OffsetDateTime;

/**
 * Un acta con foto registrada.
 *
 * `casilla` es la clave completa y `tipo` el nombre corto —B, C1—, que es lo
 * que se usa como rótulo en la galería.
 */
public record ActaReporteDTO(
        Integer idCasilla,
        String municipio,
        String seccion,
        String casilla,
        String tipo,
        String ruta,
        int bytes,
        OffsetDateTime subidaEn,
        String capturista) {
}