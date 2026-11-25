package mx.sirve.repositorio;

import mx.sirve.modelo.dto.HistorialCambioDTO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Traza de las capturas.
 *
 * La escribe un trigger de PostgreSQL, no Java: así ninguna escritura se
 * escapa, venga de donde venga. A Java le toca solo lo que el trigger no puede
 * saber —quién está detrás de la petición— y eso se pasa con
 * {@code set_config(..., true)} dentro de la transacción, que es local a ella
 * y desaparece al terminar.
 */
@Repository
public class CapturaHistorialRepositorio {

    private final JdbcTemplate jdbc;

    public CapturaHistorialRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Dice quién está escribiendo, para que el trigger lo anote.
     *
     * Tiene que llamarse dentro de la misma transacción que guarda la captura:
     * el tercer argumento de {@code set_config} lo hace local a la transacción.
     * Con valor nulo la variable queda sin definir y el trigger anota vacío, que
     * es lo correcto cuando la escritura no viene de la aplicación.
     */
    public void marcarActor(String idUsuario, String login, Integer idCapturista,
                            Integer idDispositivo, String ip, String agente) {
        /*
         * Los seis set_config van unidos con «||» por una razón mecánica: así la
         * consulta devuelve una sola columna. Sueltos, el SELECT devolvería seis
         * y Spring, que espera una, falla con «Incorrect column count».
         *
         * No se usa COALESCE: evaluaría solo el primero y los demás no llegarían
         * a ejecutarse. Con «||» se evalúan los seis aunque el resultado sea nulo.
         */
        jdbc.queryForObject("""
                SELECT set_config('app.actor_usuario', ?, true)
                    || set_config('app.actor_login', ?, true)
                    || set_config('app.actor_capturista', ?, true)
                    || set_config('app.actor_dispositivo', ?, true)
                    || set_config('app.ip', ?, true)
                    || set_config('app.agente', ?, true)
                """, String.class,
                idUsuario, login,
                idCapturista == null ? null : idCapturista.toString(),
                idDispositivo == null ? null : idDispositivo.toString(),
                ip, agente);
    }

    /**
     * Cambios filtrados por municipio, sección, casilla y elección.
     *
     * Los filtros se agregan a la consulta solo si vienen: así una pantalla sin
     * filtros no arrastra condiciones que el planeador no puede descartar. Los
     * valores van siempre como parámetros.
     */
    public HistorialCambioDTO.Pagina buscar(Integer idMunicipio, String seccion, String casilla,
                                            Integer idEleccion, int limite) {
        StringBuilder filtros = new StringBuilder(" WHERE 1 = 1");
        List<Object> valores = new ArrayList<>();

        if (idMunicipio != null) {
            filtros.append(" AND s.id_municipio = ?");
            valores.add(idMunicipio);
        }
        if (seccion != null && !seccion.isBlank()) {
            filtros.append(" AND s.clave = ?");
            valores.add(seccion.trim());
        }
        if (casilla != null && !casilla.isBlank()) {
            filtros.append(" AND k.clave ILIKE ?");
            valores.add("%" + casilla.trim() + "%");
        }
        if (idEleccion != null) {
            filtros.append(" AND h.id_eleccion = ?");
            valores.add(idEleccion);
        }

        String base = """
                FROM sirve.captura_historial h
                JOIN sirve.casilla  k ON k.id = h.id_casilla
                JOIN sirve.seccion  s ON s.id = k.id_seccion
                JOIN sirve.municipio m ON m.id = s.id_municipio
                """;

        // El conteo va aparte del límite: la pantalla dice «24 cambios» aunque
        // solo pinte los primeros cien.
        Map<String, Object> cuenta = jdbc.queryForMap(
                "SELECT count(*) AS total,"
                + " count(*) FILTER (WHERE h.accion = 'CREAR') AS altas,"
                + " count(*) FILTER (WHERE h.accion = 'REEMPLAZAR') AS reemplazos "
                + base + filtros, valores.toArray());

        List<Object> conLimite = new ArrayList<>(valores);
        conLimite.add(limite);

        List<HistorialCambioDTO> filas = jdbc.query("""
                SELECT h.id, h.accion, h.actor_login, h.actor_usuario::text AS actor_usuario,
                       h.actor_capturista, h.actor_dispositivo, h.ip::text AS ip, h.agente,
                       h.ocurrido_en, h.id_casilla, h.id_eleccion,
                       m.nombre AS municipio, s.clave AS seccion, k.clave AS casilla,
                       (h.anterior->'captura'->>'total_acta')::int    AS antes_total,
                       (h.anterior->'captura'->>'suma_opciones')::int AS antes_suma,
                       (h.anterior->'captura'->>'nulos')::int         AS antes_nulos,
                       (h.nuevo->'captura'->>'total_acta')::int       AS despues_total,
                       (h.nuevo->'captura'->>'suma_opciones')::int    AS despues_suma,
                       (h.nuevo->'captura'->>'nulos')::int            AS despues_nulos,
                       jsonb_array_length(COALESCE(h.anterior->'votos', '[]'::jsonb)) AS votos_antes
                """ + base + filtros + """
                 ORDER BY h.ocurrido_en DESC, h.id DESC
                 LIMIT ?
                """, (rs, n) -> new HistorialCambioDTO(
                        rs.getLong("id"),
                        rs.getString("accion"),
                        rs.getString("actor_login"),
                        rs.getString("actor_usuario"),
                        (Integer) rs.getObject("actor_capturista"),
                        (Integer) rs.getObject("actor_dispositivo"),
                        rs.getString("ip"),
                        rs.getString("agente"),
                        rs.getObject("ocurrido_en", OffsetDateTime.class),
                        rs.getInt("id_casilla"),
                        rs.getInt("id_eleccion"),
                        rs.getString("municipio"),
                        rs.getString("seccion"),
                        rs.getString("casilla"),
                        (Integer) rs.getObject("antes_total"),
                        (Integer) rs.getObject("antes_suma"),
                        (Integer) rs.getObject("antes_nulos"),
                        (Integer) rs.getObject("despues_total"),
                        (Integer) rs.getObject("despues_suma"),
                        (Integer) rs.getObject("despues_nulos"),
                        rs.getInt("votos_antes")),
                conLimite.toArray());

        long total = ((Number) cuenta.get("total")).longValue();
        long altas = ((Number) cuenta.get("altas")).longValue();
        long reemplazos = ((Number) cuenta.get("reemplazos")).longValue();

        return new HistorialCambioDTO.Pagina(
                new HistorialCambioDTO.Resumen(total, altas, reemplazos), filas);
    }

    /** Cambios de una casilla y elección, del más nuevo al más viejo. */
    public List<Map<String, Object>> deCasilla(int idCasilla, int idEleccion, int limite) {
        return jdbc.queryForList("""
                SELECT id, accion, actor_login, actor_usuario, actor_capturista,
                       actor_dispositivo, ip, agente, anterior, nuevo, ocurrido_en
                  FROM sirve.captura_historial
                 WHERE id_casilla = ? AND id_eleccion = ?
                 ORDER BY ocurrido_en DESC, id DESC
                 LIMIT ?
                """, idCasilla, idEleccion, limite);
    }

    /** Últimos cambios de todo el sistema, para revisar la jornada. */
    public List<Map<String, Object>> recientes(int limite) {
        return jdbc.queryForList("""
                SELECT id, id_casilla, id_eleccion, accion, actor_login,
                       actor_capturista, actor_dispositivo, ip, ocurrido_en
                  FROM sirve.captura_historial
                 ORDER BY ocurrido_en DESC, id DESC
                 LIMIT ?
                """, limite);
    }
}
