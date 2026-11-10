package mx.sirve.modelo.dto;

/**
 * Casilla asignada a un capturista, con lo necesario para mostrarla en el
 * teléfono sin consultar nada más: sección, municipio y si ya tiene acta.
 */
public record CasillaAsignadaDTO(
        Integer id,
        String clave,
        String tipo,
        String seccion,
        String municipio,
        boolean capturada) {
}