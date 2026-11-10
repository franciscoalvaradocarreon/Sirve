package mx.sirve.modelo.dto;

import java.util.List;

/**
 * Respuesta del enrolamiento.
 *
 * El pase se entrega una sola vez: el servidor guarda su hash y no puede
 * volver a mostrarlo. Si el teléfono lo pierde, se reemite el código.
 */
public record EnrolamientoDTO(
        String pase,
        Integer idCapturista,
        String nombre,
        List<CasillaAsignadaDTO> casillas) {
}