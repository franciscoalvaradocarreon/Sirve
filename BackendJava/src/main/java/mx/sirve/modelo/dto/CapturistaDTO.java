package mx.sirve.modelo.dto;

import java.time.OffsetDateTime;
import java.util.List;

/** Persona que captura, con las casillas que tiene asignadas. */
public record CapturistaDTO(
        Integer id,
        String nombre,
        String telefono,
        boolean activo,
        int casillas,
        List<CasillaAsignadaDTO> asignadas,
        OffsetDateTime creadoEn) {
}
