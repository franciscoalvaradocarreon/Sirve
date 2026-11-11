package mx.sirve.modelo.dto;

/**
 * Una sección asignada a un capturista, con lo que lleva capturado.
 *
 * `otros` cuenta las demás personas asignadas a la misma sección. Dos
 * capturistas en la misma sección no es un error —a veces se cubre entre
 * dos—, pero conviene verlo antes de la jornada y no descubrirlo al capturar.
 */
public record AsignacionDTO(
        Integer idCapturista,
        String capturista,
        String municipio,
        String seccion,
        int casillas,
        int capturadas,
        int otros) {
}
