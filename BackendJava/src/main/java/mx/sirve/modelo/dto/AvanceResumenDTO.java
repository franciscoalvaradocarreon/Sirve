package mx.sirve.modelo.dto;

import java.util.List;

/**
 * Reporte de avance de una elección.
 *
 * Los totales vienen calculados aunque se puedan sumar de las filas: la
 * pantalla los muestra siempre y sumarlos en el cliente daría un número
 * distinto si alguna fila llegara filtrada.
 */
public record AvanceResumenDTO(
        String agrupacion,
        int casillas,
        int capturadas,
        List<AvanceDTO> filas) {
}
