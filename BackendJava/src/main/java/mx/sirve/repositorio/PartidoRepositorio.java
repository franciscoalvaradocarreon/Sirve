package mx.sirve.repositorio;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Catálogo de partidos.
 *
 * El color vive aquí y en la opción de boleta. Aquí es el color oficial —uno
 * por partido, el mismo en todas las elecciones—; allá es el que se dibuja, que
 * para las coaliciones es otro.
 */
@Repository
public class PartidoRepositorio {

    public record Partido(int id, String clave, String nombre, String color,
                          short orden, boolean activo) {
    }

    private final JdbcTemplate jdbc;

    public PartidoRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<Partido> FILA = (rs, n) -> new Partido(
            rs.getInt("id"),
            rs.getString("clave"),
            rs.getString("nombre"),
            rs.getString("color"),
            rs.getShort("orden"),
            rs.getBoolean("activo"));

    public List<Partido> listar() {
        return jdbc.query("""
                SELECT id, clave, nombre, color, orden, activo
                  FROM sirve.partido
                 ORDER BY orden, clave
                """, FILA);
    }

    public Optional<Partido> buscar(int id) {
        return jdbc.query("""
                SELECT id, clave, nombre, color, orden, activo
                  FROM sirve.partido WHERE id = ?
                """, FILA, id).stream().findFirst();
    }

    public boolean claveOcupada(String clave) {
        Integer n = jdbc.queryForObject(
                "SELECT count(*) FROM sirve.partido WHERE upper(clave) = upper(?)",
                Integer.class, clave);
        return n != null && n > 0;
    }

    public int crear(String clave, String nombre, String color, short orden) {
        Integer id = jdbc.queryForObject("""
                INSERT INTO sirve.partido (clave, nombre, color, orden, activo)
                VALUES (?, ?, ?, ?, true)
                RETURNING id
                """, Integer.class, clave, nombre, color, orden);
        return id == null ? 0 : id;
    }

    public void actualizar(int id, String nombre, String color, short orden, boolean activo) {
        jdbc.update("""
                UPDATE sirve.partido
                   SET nombre = ?, color = ?, orden = ?, activo = ?
                 WHERE id = ?
                """, nombre, color, orden, activo, id);
    }

    /**
     * Reparte el color del catálogo a las opciones de boleta del partido.
     *
     * Se hace al guardar para que el cambio se vea de inmediato en las
     * gráficas, sin esperar a que alguien vuelva a correr la migración.
     */
    public void propagarColor(int idPartido, String color) {
        jdbc.update("""
                UPDATE sirve.opcion_boleta SET color = ?
                 WHERE id_partido = ?
                """, color, idPartido);
    }
}
