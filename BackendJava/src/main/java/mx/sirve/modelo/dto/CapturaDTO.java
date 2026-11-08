package mx.sirve.modelo.dto;

import java.time.OffsetDateTime;

/**
 * Captura tal como se devuelve al cliente.
 *
 * aritmetica_ok y diferencia vienen calculadas por la base (columnas
 * generadas), no por el servidor: así el cálculo vive en un solo lugar.
 */
public record CapturaDTO(
        Long id,
        Integer idCasilla,
        Integer idEleccion,
        Integer totalActa,
        Integer noRegistrados,
        Integer nulos,
        Integer sumaOpciones,
        Integer diferencia,
        Boolean aritmeticaOk,
        OffsetDateTime recibidaEn) {
}