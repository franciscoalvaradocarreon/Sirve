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
 * subió la foto. El tablero interno tampoco los necesita para responder
 * «¿cómo va la captura?».
 */
@Repository
public class AvanceOperacionRepositorio {

    private final JdbcTemplate jdbc;

    public AvanceOperacionRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Elecciones del proceso activo, solo id y nombre: es lo único público. */
    public List<Map<String, Object>> eleccionesPublicables() {
        return jdbc.queryForList("""
                SELECT e.id, e.nombre
                  FROM sirve.eleccion e
                  JOIN sirve.proceso_electoral p ON p.id = e.id_proceso
                 WHERE p.activo
                 ORDER BY e.id
                """);
    }

    /** Nombre de la elección, para rotular la pantalla. */
    public String nombreEleccion(int idEleccion) {
        return jdbc.queryForObject(
                "SELECT nombre FROM sirve.eleccion WHERE id = ?", String.class, idEleccion);
    }

    /** Cuántas casillas tiene la elección y cuántas llevan captura vigente. */
    public Map<String, Object> totales(int idEleccion) {
        return jdbc.queryForMap("""
                SELECT
                  (SELECT count(*) FROM sirve.casilla_eleccion
                    WHERE id_eleccion = ?) AS total,
                  (SELECT count(*) FROM sirve.captura
                    WHERE id_eleccion = ? AND estado = 'VIGENTE') AS capturadas,
                  (SELECT count(*) FROM sirve.acta_foto
                    WHERE id_eleccion = ?) AS con_foto,
                  (SELECT count(*) FROM sirve.captura
                    WHERE id_eleccion = ? AND estado = 'VIGENTE'
                      AND coalesce(aritmetica_ok, true) = false) AS sin_cuadrar,
                  (SELECT max(recibida_en) FROM sirve.captura
                    WHERE id_eleccion = ?) AS ultima
                """, idEleccion, idEleccion, idEleccion, idEleccion, idEleccion);
    }

    /**
     * Resultados por opción, sumando los votos capturados.
     *
     * Se suman los votos de todas las casillas con captura vigente. El
     * porcentaje se calcula sobre la suma, no sobre el total del acta: son
     * cosas distintas y mezclarlas daría cifras que no cuadran con nada.
     */
    public List<Map<String, Object>> resultados(int idEleccion) {
        return jdbc.queryForList("""
                SELECT o.etiqueta,
                       sum(cv.votos) AS votos
                  FROM sirve.captura c
                  JOIN sirve.captura_voto cv ON cv.id_captura = c.id
                  JOIN sirve.opcion_boleta o  ON o.id = cv.id_opcion
                 WHERE c.id_eleccion = ? AND c.estado = 'VIGENTE'
                 GROUP BY o.etiqueta, o.orden
                 ORDER BY votos DESC, o.orden
                """, idEleccion);
    }

    /** Avance por municipio: cuántas casillas y cuántas capturadas. */
    public List<Map<String, Object>> porMunicipio(int idEleccion) {
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
                 WHERE ce.id_eleccion = ?
                 GROUP BY m.nombre
                 ORDER BY m.nombre
                """, idEleccion);
    }

    /** Capturas por hora de las últimas 24 horas: el ritmo de la jornada. */
    public List<Map<String, Object>> porHora(int idEleccion) {
        return jdbc.queryForList("""
                SELECT date_trunc('hour', recibida_en) AS hora, count(*) AS capturas
                  FROM sirve.captura
                 WHERE id_eleccion = ? AND estado = 'VIGENTE'
                   AND recibida_en > now() - interval '24 hours'
                 GROUP BY 1
                 ORDER BY 1
                """, idEleccion);
    }

    /**
     * Secciones con menos avance.
     *
     * Es la lista que sirve para actuar: dice dónde mandar gente, no cuánto
     * se ha capturado en total.
     */
    public List<Map<String, Object>> seccionesAtrasadas(int idEleccion, int limite) {
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
                 WHERE ce.id_eleccion = ?
                 GROUP BY m.nombre, s.clave
                HAVING count(c.id) < count(*)
                 ORDER BY (count(c.id)::numeric / count(*)) ASC, length(s.clave), s.clave
                 LIMIT ?
                """, idEleccion, limite);
    }

    /** Casillas capturadas cuya aritmética no cuadra, para revisarlas. */
    public List<Map<String, Object>> sinCuadrar(int idEleccion, int limite) {
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
                   AND coalesce(c.aritmetica_ok, true) = false
                 ORDER BY abs(coalesce(c.diferencia, 0)) DESC
                 LIMIT ?
                """, idEleccion, limite);
    }

    /** Última vez que llegó una captura, para el sello de «actualizado». */
    public OffsetDateTime ultimaCaptura(int idEleccion) {
        return jdbc.queryForObject("""
                SELECT max(recibida_en) FROM sirve.captura
                 WHERE id_eleccion = ? AND estado = 'VIGENTE'
                """, OffsetDateTime.class, idEleccion);
    }
}
