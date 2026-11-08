package mx.sirve.modelo.dto;

/**
 * Elección de un proceso, con lo que cuelga de ella.
 *
 * casillas y opciones dicen si la elección está lista para capturar;
 * capturadas dice cuánto avance lleva.
 */
public record EleccionDTO(
        Integer id,
        String clave,
        String nombre,
        String tipo,
        Integer orden,
        Boolean activa,
        Integer casillas,
        Integer opciones,
        Integer capturadas) {
}