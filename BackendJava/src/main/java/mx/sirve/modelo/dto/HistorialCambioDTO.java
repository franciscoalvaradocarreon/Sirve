package mx.sirve.modelo.dto;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Un cambio del historial de capturas, ya con los nombres que se leen en
 * pantalla: municipio, sección y casilla en lugar de sus identificadores.
 *
 * El antes y el después vienen como números sueltos y no como el jsonb
 * completo: la pantalla muestra cuatro cifras y enviar el objeto entero por
 * cada renglón sería cargar con megabytes para pintar una tabla.
 */
public record HistorialCambioDTO(
        long id,
        String accion,
        String actorLogin,
        String actorUsuario,
        Integer actorCapturista,
        Integer actorDispositivo,
        String ip,
        String agente,
        OffsetDateTime ocurridoEn,

        int idCasilla,
        int idEleccion,
        String municipio,
        String seccion,
        String casilla,
        String tipo,

        Integer antesTotal,
        Integer antesSuma,
        Integer antesNulos,
        Integer despuesTotal,
        Integer despuesSuma,
        Integer despuesNulos,

        int votosAntes) {

    /** Cuántos cambios hay con los filtros puestos, y cuántos son reemplazos. */
    public record Resumen(long total, long altas, long reemplazos) {
    }

    /** Lo que devuelve la consulta: el conteo arriba y los renglones abajo. */
    public record Pagina(Resumen resumen, List<HistorialCambioDTO> filas) {
    }
}
