package mx.sirve.modelo.dto;

/**
 * Distrito electoral.
 *
 * El tipo distingue local de federal; son la misma tabla, por eso comparten
 * DTO y pantalla.
 */
public record DistritoDTO(
        Integer id,
        String clave,
        String nombre,
        String tipo,
        Integer secciones) {
}