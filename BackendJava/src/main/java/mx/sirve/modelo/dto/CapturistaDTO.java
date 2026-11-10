package mx.sirve.modelo.dto;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Persona que captura, con las secciones que tiene asignadas.
 *
 * Se asignan secciones, no casillas: es como se reparte el trabajo en campo y
 * deja el catálogo más corto. Las casillas del capturista salen de ellas.
 */
public record CapturistaDTO(
        Integer id,
        String nombre,
        String telefono,
        boolean activo,
        int casillas,
        List<SeccionAsignadaDTO> secciones,
        OffsetDateTime creadoEn) {
}