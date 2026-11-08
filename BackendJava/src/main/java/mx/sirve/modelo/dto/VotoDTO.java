package mx.sirve.modelo.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/** Un renglón del acta: cuántos votos recibió una opción de la boleta. */
public record VotoDTO(

        @NotNull(message = "falta id_opcion")
        Integer idOpcion,

        @NotNull(message = "falta votos")
        @Min(value = 0, message = "votos no puede ser negativo")
        Integer votos) {
}