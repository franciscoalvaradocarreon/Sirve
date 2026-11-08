package mx.sirve.modelo.dto;

/**
 * Casilla con su ubicación administrativa y su estado de captura.
 *
 * Trae municipio, sección y distritos para que la pantalla pueda mostrarlas
 * sin una consulta por fila.
 */
public record CasillaDTO(
        Integer id,
        String clave,
        String tipo,
        String direccion,
        String ubicacion,
        String seccion,
        String municipio,
        String distritoLocal,
        String distritoFederal,
        Boolean capturada,
        Integer totalActa,
        Boolean aritmeticaOk) {
}