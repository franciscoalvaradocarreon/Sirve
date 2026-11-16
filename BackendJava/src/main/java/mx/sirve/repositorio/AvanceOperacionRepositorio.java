package mx.sirve.repositorio;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * Consultas agregadas para el tablero y la sala de resultados.
 *
 * Todas agregan en la base y devuelven cifras ya sumadas: un tablero que trae
 * una fila por casilla y suma en el navegador se cae solo cuando la elección
 * tiene miles de casillas y la jornada avanza.
 *
 * Nada de esto devuelve identidades: ni nombres de capturistas ni de quién
 * subió la foto.
 *
 * El ámbito permite mirar una elección completa o solo un distrito o un
 * municipio. El filtro se arma aquí, a partir de un tipo fijo y un número: la
 * columna nunca viene de fuera, solo de la lista de abajo.
 */
@Repository
public class AvanceOperacionRepositorio {

    /** Qué parte de la elección se está mirando. */
    public record Ambito(String columna, Integer id) {

        public static final Ambito TODO = new Ambito(null, null);

        /** Filtro para pegar al final de un WHERE, ya con la tabla «s». */
        public String filtro() {
            return columna == null || id == null ? "" : " AND s." + columna + " = " + id;
        }
    }

    /**
     * Alcance de una elección según su tipo.
     *
     * Gobernatura y las federales de representación proporcional se miran por
     * estado; las diputaciones por distrito; los ayuntamientos por municipio.
     */
    public static String columnaDeAmbito(String tipoEleccion) {
        return switch (tipoEleccion) {
            case "DIPUTACION_LOCAL" -> "id_distrito_local";
            case "DIPUTACION_FEDERAL" -> "id_distrito_federal";
            case "PRESIDENCIA_MUNICIPAL" -> "id_municipio";
            default -> null;
        };
    }

    private final JdbcTemplate jdbc;

    public AvanceOperacionRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Elecciones del proceso activo, con su tipo, para armar las pestañas. */
    public List<Map<String, Object>> eleccionesPublicables() {
        return jdbc.queryForList("""
                SELECT e.id, e.nombre, e.tipo::text AS tipo
                  FROM sirve.eleccion e
                  JOIN sirve.proceso_electoral p ON p.id = e.id_proceso
                 WHERE p.activo
                 ORDER BY e.orden, e.id
                """);
    }

    /** Distritos de una elección, en orden de clave. */
    public List<Map<String, Object>> distritos(String tipoDistrito) {
        return jdbc.queryForList("""
                SELECT d.id, d.clave, d.nombre
                  FROM sirve.distrito d
                 WHERE d.tipo = ?::sirve.tipo_distrito
                 ORDER BY length(d.clave), d.clave
                """, tipoDistrito);
    }

    /** Municipios con casillas en una elección. */
    public List<Map<String, Object>> municipiosDe(int idEleccion) {
        return jdbc.queryForList("""
                SELECT DISTINCT m.id, m.nombre
                  FROM sirve.casilla_eleccion ce
                  JOIN sirve.casilla k ON k.id = ce.id_casilla
                  JOIN sirve.seccion s ON s.id = k.id_seccion
                  JOIN sirve.municipio m ON m.id = s.id_municipio
                 WHERE ce.id_eleccion = ?
                 ORDER BY m.nombre
                """, idEleccion);
    }

    /** Nombre de la elección, para rotular la pantalla. */
    public String nombreEleccion(int idEleccion) {
        return jdbc.queryForObject(
                "SELECT nombre FROM sirve.eleccion WHERE id = ?", String.class, idEleccion);
    }

    /** Tipo de la elección: define si se mira por estado, distrito o municipio. */
    public String tipoEleccion(int idEleccion) {
        return jdbc.queryForObject(
                "SELECT tipo::text FROM sirve.eleccion WHERE id = ?", String.class, idEleccion);
    }

    /** Cuántas casillas entran en el ámbito y cuántas llevan captura vigente. */
    public Map<String, Object> totales(int idEleccion, Ambito ambito) {
        String f = ambito.filtro();
        return jdbc.queryForMap("""
                SELECT
                  (SELECT count(*)
                     FROM sirve.casilla_eleccion ce
                     JOIN sirve.casilla k ON k.id = ce.id_casilla
                     JOIN sirve.seccion s ON s.id = k.id_seccion
                    WHERE ce.id_eleccion = ?%s) AS total,
                  (SELECT count(*)
                     FROM sirve.captura c
                     JOIN sirve.casilla k ON k.id = c.id_casilla
                     JOIN sirve.seccion s ON s.id = k.id_seccion
                    WHERE c.id_eleccion = ? AND c.estado = 'VIGENTE'%s) AS capturadas,
                  (SELECT count(*)
                     FROM sirve.acta_foto f
                     JOIN sirve.casilla k ON k.id = f.id_casilla
                     JOIN sirve.seccion s ON s.id = k.id_seccion
                    WHERE f.id_eleccion = ?%s) AS con_foto,
                  (SELECT count(*)
                     FROM sirve.captura c
                     JOIN sirve.casilla k ON k.id = c.id_casilla
                     JOIN sirve.seccion s ON s.id = k.id_seccion
                    WHERE c.id_eleccion = ? AND c.estado = 'VIGENTE'
                      AND coalesce(c.aritmetica_ok, true) = false%s) AS sin_cuadrar,
                  (SELECT max(c.recibida_en)
                     FROM sirve.captura c
                     JOIN sirve.casilla k ON k.id = c.id_casilla
                     JOIN sirve.seccion s ON s.id = k.id_seccion
                    WHERE c.id_eleccion = ?%s) AS ultima
                """.formatted(f, f, f, f, f),
                idEleccion, idEleccion, idEleccion, idEleccion, idEleccion);
    }

    /** Resultados por opción dentro del ámbito. */
    public List<Map<String, Object>> resultados(int idEleccion, Ambito ambito) {
        return jdbc.queryForList("""
                SELECT o.id AS id_opcion,
                       o.etiqueta,
                       coalesce(o.color, '#546E7A') AS color,
                       sum(cv.votos) AS votos
                  FROM sirve.captura c
                  JOIN sirve.casilla k ON k.id = c.id_casilla
                  JOIN sirve.seccion s ON s.id = k.id_seccion
                  JOIN sirve.captura_voto cv ON cv.id_captura = c.id
                  JOIN sirve.opcion_boleta o  ON o.id = cv.id_opcion
                 WHERE c.id_eleccion = ? AND c.estado = 'VIGENTE'%s
                 GROUP BY o.id, o.etiqueta, o.color, o.orden
                 ORDER BY votos DESC, o.orden
                """.formatted(ambito.filtro()), idEleccion);
    }

    /** Avance por municipio dentro del ámbito. */
    public List<Map<String, Object>> porMunicipio(int idEleccion, Ambito ambito) {
        return jdbc.queryForList("""
                SELECT m.nombre AS municipio,
                       count(*) AS total,
                       count(c.id) AS capturadas
                  FROM sirve.casilla_eleccion ce
                  JOIN sirve.casilla k  ON k.id = ce.id_casilla
                  JOIN sirve.seccion s  ON s.id = k.id_seccion
                  JOIN sirve.municipio m ON m.id = s.id_municipio
                  LEFT JOIN sirve.captura c
                         ON c.id_casilla = ce.id_casilla
                        AND c.id_eleccion = ce.id_eleccion
                        AND c.estado = 'VIGENTE'
                 WHERE ce.id_eleccion = ?%s
                 GROUP BY m.nombre
                 ORDER BY m.nombre
                """.formatted(ambito.filtro()), idEleccion);
    }

    /** Capturas por hora de las últimas 24 horas: el ritmo de la jornada. */
    public List<Map<String, Object>> porHora(int idEleccion, Ambito ambito) {
        return jdbc.queryForList("""
                SELECT date_trunc('hour', c.recibida_en) AS hora, count(*) AS capturas
                  FROM sirve.captura c
                  JOIN sirve.casilla k ON k.id = c.id_casilla
                  JOIN sirve.seccion s ON s.id = k.id_seccion
                 WHERE c.id_eleccion = ? AND c.estado = 'VIGENTE'
                   AND c.recibida_en > now() - interval '24 hours'%s
                 GROUP BY 1
                 ORDER BY 1
                """.formatted(ambito.filtro()), idEleccion);
    }

    /** Secciones con menos avance. */
    public List<Map<String, Object>> seccionesAtrasadas(int idEleccion, Ambito ambito, int limite) {
        return jdbc.queryForList("""
                SELECT m.nombre AS municipio,
                       s.clave   AS seccion,
                       count(*)  AS total,
                       count(c.id) AS capturadas
                  FROM sirve.casilla_eleccion ce
                  JOIN sirve.casilla k  ON k.id = ce.id_casilla
                  JOIN sirve.seccion s  ON s.id = k.id_seccion
                  JOIN sirve.municipio m ON m.id = s.id_municipio
                  LEFT JOIN sirve.captura c
                         ON c.id_casilla = ce.id_casilla
                        AND c.id_eleccion = ce.id_eleccion
                        AND c.estado = 'VIGENTE'
                 WHERE ce.id_eleccion = ?%s
                 GROUP BY m.nombre, s.clave
                HAVING count(c.id) < count(*)
                 ORDER BY (count(c.id)::numeric / count(*)) ASC, length(s.clave), s.clave
                 LIMIT ?
                """.formatted(ambito.filtro()), idEleccion, limite);
    }

    /** Casillas capturadas cuya aritmética no cuadra. */
    public List<Map<String, Object>> sinCuadrar(int idEleccion, Ambito ambito, int limite) {
        return jdbc.queryForList("""
                SELECT m.nombre AS municipio,
                       s.clave   AS seccion,
                       k.tipo    AS casilla,
                       c.total_acta,
                       c.suma_opciones,
                       c.diferencia
                  FROM sirve.captura c
                  JOIN sirve.casilla k  ON k.id = c.id_casilla
                  JOIN sirve.seccion s  ON s.id = k.id_seccion
                  JOIN sirve.municipio m ON m.id = s.id_municipio
                 WHERE c.id_eleccion = ? AND c.estado = 'VIGENTE'
                   AND coalesce(c.aritmetica_ok, true) = false%s
                 ORDER BY abs(coalesce(c.diferencia, 0)) DESC
                 LIMIT ?
                """.formatted(ambito.filtro()), idEleccion, limite);
    }

    /** Última vez que llegó una captura dentro del ámbito. */
    public OffsetDateTime ultimaCaptura(int idEleccion, Ambito ambito) {
        return jdbc.queryForObject("""
                SELECT max(c.recibida_en)
                  FROM sirve.captura c
                  JOIN sirve.casilla k ON k.id = c.id_casilla
                  JOIN sirve.seccion s ON s.id = k.id_seccion
                 WHERE c.id_eleccion = ? AND c.estado = 'VIGENTE'%s
                """.formatted(ambito.filtro()), OffsetDateTime.class, idEleccion);
    }
}
