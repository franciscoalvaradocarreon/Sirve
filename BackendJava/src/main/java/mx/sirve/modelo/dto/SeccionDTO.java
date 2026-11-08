package mx.sirve.modelo.dto;

/**
 * Sección electoral con su municipio, sus distritos y cuántas casillas tiene.
 *
 * Los distritos pueden venir nulos: en 2021 no se cargó la cartografía
 * federal, así que esas secciones no tienen distrito federal asignado.
 */
public record SeccionDTO(
        Integer id,
        String clave,
        String municipio,
        Integer casillas,
        String distritoLocal,
        String distritoFederal) {
}