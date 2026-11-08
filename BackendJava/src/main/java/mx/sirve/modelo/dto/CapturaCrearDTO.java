package mx.sirve.modelo.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

/**
 * Cuerpo para guardar o reemplazar una captura.
 *
 * No incluye suma_opciones: la calcula el servidor sumando los votos. Si el
 * cliente pudiera mandarla, podría mentir y la suma dejaría de cuadrar con el
 * detalle.
 */
public record CapturaCrearDTO(

        @NotNull(message = "falta id_cliente")
        UUID idCliente,

        @NotNull(message = "falta id_casilla")
        Integer idCasilla,

        @NotNull(message = "falta id_eleccion")
        Integer idEleccion,

        @NotNull(message = "falta total_acta")
        @Min(value = 0, message = "total_acta no puede ser negativo")
        Integer totalActa,

        @Min(value = 0, message = "no_registrados no puede ser negativo")
        Integer noRegistrados,

        @Min(value = 0, message = "nulos no puede ser negativo")
        Integer nulos,

        @NotEmpty(message = "no se enviaron votos por opción")
        List<@Valid VotoDTO> votos,

        @Size(max = 200, message = "autor_texto es demasiado largo")
        String autorTexto) {
}
