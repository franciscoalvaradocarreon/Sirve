package mx.sirve.repositorio;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

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
