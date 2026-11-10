package mx.sirve.modelo.dto;

/** Sección asignada a un capturista, para mostrarla en la administración. */
public record SeccionAsignadaDTO(
        Integer id,
        String clave,
        String municipio,
        int casillas) {
}