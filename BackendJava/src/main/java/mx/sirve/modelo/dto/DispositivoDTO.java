package mx.sirve.modelo.dto;

import java.time.OffsetDateTime;

/** Teléfono enrolado de un capturista. Nunca incluye el pase ni el código. */
public record DispositivoDTO(
        Integer id,
        String nombre,
        boolean activo,
        boolean enrolado,
        OffsetDateTime enroladoEn,
        OffsetDateTime ultimoUso) {
}