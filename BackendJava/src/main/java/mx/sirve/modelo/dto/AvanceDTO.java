package mx.sirve.modelo.dto;

/**
 * Una fila del reporte de avance: un municipio o un distrito, con cuántas
 * casillas le corresponden en la elección y cuántas ya tienen captura.
 *
 * No se envía el porcentaje: es una división que el cliente puede hacer y
 * mandarla calculada invita a que dos pantallas redondeen distinto.
 */
public record AvanceDTO(
        Integer id,
        String clave,
        String nombre,
        int casillas,
        int capturadas) {
}
