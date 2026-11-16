package mx.sirve.repositorio;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Opciones de boleta de una elección.
 *
 * Es la tabla que dice qué aparece en la papeleta: partidos sueltos, coaliciones
 * y —si algún día se usa— candidaturas independientes. La clave que se guarda
 * aquí es la que lee el capturista en el acta, así que no se cambia a la ligera.
 */
@Repository
public class BoletaRepositorio {

    public record Opcion(int id, int idEleccion, String tipo, String etiqueta,
                         String color, short orden, boolean activo, boolean tieneLogo,
                         Integer idPartido, Integer idCoalicion, String integrantes) {
    }

    public record Logo(byte[] datos, String tipo) {
    }

    private final JdbcTemplate jdbc;

    public BoletaRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<Opcion> FILA = (rs, n) -> new Opcion(
            rs.getInt("id"),
            rs.getInt("id_eleccion"),
            rs.getString("tipo"),
            rs.getString("etiqueta"),
            rs.getString("color"),
            rs.getShort("orden"),
            rs.getBoolean("activo"),
            rs.getBytes("logo") != null,
            (Integer) rs.getObject("id_partido"),
            (Integer) rs.getObject("id_coalicion"),
            rs.getString("integrantes"));

    public List<Opcion> deEleccion(int idEleccion) {
        return jdbc.query("""
                SELECT o.id, o.id_eleccion, o.tipo::text AS tipo, o.etiqueta, o.color,
                       o.orden, o.activo, o.logo, o.id_partido, o.id_coalicion,
                       coalesce((SELECT string_agg(p.clave, ' + ' ORDER BY p.orden)
                                   FROM sirve.coalicion_partido cp
                                   JOIN sirve.partido p ON p.id = cp.id_partido
                                  WHERE cp.id_coalicion = o.id_coalicion), '') AS integrantes
                  FROM sirve.opcion_boleta o
                 WHERE o.id_eleccion = ?
                 ORDER BY o.orden, o.etiqueta
                """, FILA, idEleccion);
    }

    public Optional<Opcion> buscar(int id) {
        return jdbc.query("""
                SELECT o.id, o.id_eleccion, o.tipo::text AS tipo, o.etiqueta, o.color,
                       o.orden, o.activo, o.logo, o.id_partido, o.id_coalicion,
                       coalesce((SELECT string_agg(p.clave, ' + ' ORDER BY p.orden)
                                   FROM sirve.coalicion_partido cp
                                   JOIN sirve.partido p ON p.id = cp.id_partido
                                  WHERE cp.id_coalicion = o.id_coalicion), '') AS integrantes
                  FROM sirve.opcion_boleta o
                 WHERE o.id = ?
                """, FILA, id).stream().findFirst();
    }

    /** Elecciones con su proceso, para el selector de la pantalla. */
    public List<Map<String, Object>> elecciones() {
        return jdbc.queryForList("""
                SELECT e.id, e.nombre, e.orden, p.anio, p.id AS id_proceso
                  FROM sirve.eleccion e
                  JOIN sirve.proceso_electoral p ON p.id = e.id_proceso
                 WHERE e.activa
                 ORDER BY p.anio DESC, e.orden, e.id
                """);
    }

    public Map<String, Object> eleccion(int idEleccion) {
        return jdbc.queryForMap("""
                SELECT e.id, e.nombre, e.id_proceso
                  FROM sirve.eleccion e WHERE e.id = ?
                """, idEleccion);
    }

    /** Partidos que aún no están en la boleta. */
    public List<Map<String, Object>> partidosDisponibles(int idEleccion) {
        return jdbc.queryForList("""
                SELECT p.id, p.clave, p.nombre, p.color
                  FROM sirve.partido p
                 WHERE p.activo
                   AND NOT EXISTS (SELECT 1 FROM sirve.opcion_boleta o
                                    WHERE o.id_eleccion = ? AND o.id_partido = p.id)
                 ORDER BY p.orden, p.clave
                """, idEleccion);
    }

    public boolean etiquetaOcupada(int idEleccion, String etiqueta) {
        Integer n = jdbc.queryForObject("""
                SELECT count(*) FROM sirve.opcion_boleta
                 WHERE id_eleccion = ? AND upper(etiqueta) = upper(?)
                """, Integer.class, idEleccion, etiqueta);
        return n != null && n > 0;
    }

    public short siguienteOrden(int idEleccion) {
        Integer max = jdbc.queryForObject(
                "SELECT coalesce(max(orden), 0) FROM sirve.opcion_boleta WHERE id_eleccion = ?",
                Integer.class, idEleccion);
        return (short) ((max == null ? 0 : max) + 1);
    }

    /**
     * Agrega un partido a la boleta.
     *
     * Toma color y logo del catálogo: al agregarlo no se pregunta nada, ya se
     * sabe cómo se ve ese partido.
     */
    public int agregarPartido(int idEleccion, int idPartido, String clave, short orden) {
        Integer id = jdbc.queryForObject("""
                INSERT INTO sirve.opcion_boleta
                       (id_eleccion, tipo, id_partido, etiqueta, orden, activo, color, logo, logo_tipo)
                SELECT ?, 'PARTIDO', p.id, ?, ?, true, p.color, p.logo, p.logo_tipo
                  FROM sirve.partido p WHERE p.id = ?
                RETURNING id
                """, Integer.class, idEleccion, clave, orden, idPartido);
        return id == null ? 0 : id;
    }

    /** Agrega una coalición: la crea en el proceso y la liga a la boleta. */
    public int agregarCoalicion(int idEleccion, int idProceso, String clave,
                                List<Integer> idPartidos, String color, short orden) {

        Integer idCoalicion = jdbc.queryForObject("""
                INSERT INTO sirve.coalicion (id_proceso, clave, nombre, activa, color)
                VALUES (?, ?, ?, true, ?)
                ON CONFLICT (id_proceso, clave) DO UPDATE SET nombre = EXCLUDED.nombre
                RETURNING id
                """, Integer.class, idProceso, clave, clave, color);

        for (Integer idPartido : idPartidos) {
            jdbc.update("""
                    INSERT INTO sirve.coalicion_partido (id_coalicion, id_partido)
                    VALUES (?, ?) ON CONFLICT DO NOTHING
                    """, idCoalicion, idPartido);
        }

        Integer id = jdbc.queryForObject("""
                INSERT INTO sirve.opcion_boleta
                       (id_eleccion, tipo, id_coalicion, etiqueta, orden, activo, color)
                VALUES (?, 'COALICION', ?, ?, ?, true, ?)
                RETURNING id
                """, Integer.class, idEleccion, idCoalicion, clave, orden, color);
        return id == null ? 0 : id;
    }

    public void actualizar(int id, String etiqueta, String color, short orden, boolean activo) {
        jdbc.update("""
                UPDATE sirve.opcion_boleta
                   SET etiqueta = ?, color = ?, orden = ?, activo = ?
                 WHERE id = ?
                """, etiqueta, color, orden, activo, id);
    }

    /** Cuántas capturas usan esta opción: si hay, no se puede borrar. */
    public int votosRegistrados(int idOpcion) {
        Integer n = jdbc.queryForObject(
                "SELECT count(*) FROM sirve.captura_voto WHERE id_opcion = ?",
                Integer.class, idOpcion);
        return n == null ? 0 : n;
    }

    public void borrar(int id) {
        jdbc.update("DELETE FROM sirve.opcion_boleta WHERE id = ?", id);
    }

    /** Logo de la coalición, para copiarlo a la opción al crearla. */
    public void copiarLogoDeCoalicion(int idOpcion, int idCoalicion) {
        jdbc.update("""
                UPDATE sirve.opcion_boleta o
                   SET logo = c.logo, logo_tipo = c.logo_tipo
                  FROM sirve.coalicion c
                 WHERE o.id = ? AND c.id = ? AND c.logo IS NOT NULL
                """, idOpcion, idCoalicion);
    }

    public void guardarLogo(int idOpcion, byte[] datos, String tipo) {
        jdbc.update("UPDATE sirve.opcion_boleta SET logo = ?, logo_tipo = ? WHERE id = ?",
                datos, tipo, idOpcion);
    }

    public void borrarLogo(int idOpcion) {
        jdbc.update("UPDATE sirve.opcion_boleta SET logo = NULL, logo_tipo = NULL WHERE id = ?", idOpcion);
    }

    public Optional<Logo> logo(int idOpcion) {
        return jdbc.query("SELECT logo, logo_tipo FROM sirve.opcion_boleta WHERE id = ?",
                (rs, n) -> new Logo(rs.getBytes("logo"), rs.getString("logo_tipo")), idOpcion)
                .stream().filter(l -> l.datos() != null).findFirst();
    }
}
