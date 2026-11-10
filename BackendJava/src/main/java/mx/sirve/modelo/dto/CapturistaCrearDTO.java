package mx.sirve.modelo.dto;

import java.util.List;

/**
 * Alta o edición de un capturista.
 *
 * `secciones` reemplaza la asignación completa: lo que no venga, se quita. Es
 * un PUT, no un parche, para que no queden secciones viejas olvidadas.
 */
public record CapturistaCrearDTO(
        String nombre,
        String telefono,
        Boolean activo,
        List<Integer> secciones) {
}