package mx.sirve.modelo.dto;

/**
 * Proceso electoral tal como lo ve el cliente.
 *
 * Los nombres en Java van en camelCase; el JSON sale en snake_case por la
 * estrategia global de Jackson declarada en application.yml.
 */
public record ProcesoDTO(
        Integer id,
        Integer anio,
        String nombre,
        String estado,
        Boolean activo,
        String fechaJornada,
        String entidad) {
}
