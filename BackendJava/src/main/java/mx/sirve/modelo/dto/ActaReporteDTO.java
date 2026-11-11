package mx.sirve.modelo.dto;

import java.time.OffsetDateTime;

/** Un acta con foto registrada, para el reporte de consulta. */
public record ActaReporteDTO(
        Integer idCasilla,
        String municipio,
        String seccion,
        String casilla,
        String ruta,
        int bytes,
        OffsetDateTime subidaEn,
        String capturista) {
}