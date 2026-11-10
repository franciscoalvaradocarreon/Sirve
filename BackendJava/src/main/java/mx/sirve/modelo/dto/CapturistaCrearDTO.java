package mx.sirve.modelo.dto;

import java.util.List;

/**
 * Alta o edición de un capturista.
 *
 * `casillas` reemplaza la asignación completa: lo que no venga, se quita. Es
 * un PUT, no un parche, para que no queden asignaciones viejas olvidadas.
 */
public record CapturistaCrearDTO(
        String nombre,
        String telefono,
        Boolean activo,
        List<Integer> casillas) {
}