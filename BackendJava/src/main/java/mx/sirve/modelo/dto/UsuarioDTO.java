package mx.sirve.modelo.dto;

import java.time.OffsetDateTime;

/** Un usuario del escritorio. Nunca lleva el hash. */
public record UsuarioDTO(
        String id,
        String usuario,
        String nombre,
        String rol,
        String rolNombre,
        boolean activo,
        OffsetDateTime ultimoAcceso) {
}