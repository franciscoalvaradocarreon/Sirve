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
                          short orden, boolean activo, boolean tieneLogo) {
    }

    /** Bytes y tipo del logo, para servirlo. */
    public record Logo(byte[] datos, String tipo) {
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
            rs.getBoolean("activo"),
            rs.getBytes("logo") != null);

    public List<Partido> listar() {
        return jdbc.query("""
                SELECT id, clave, nombre, color, orden, activo, logo, logo_tipo
                  FROM sirve.partido
                 ORDER BY orden, clave
                """, FILA);
    }

    public Optional<Partido> buscar(int id) {
        return jdbc.query("""
                SELECT id, clave, nombre, color, orden, activo, logo, logo_tipo
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
    /** Logo del partido, o vacío si no tiene. */
    public Optional<Logo> logo(int id) {
        return jdbc.query("""
                SELECT logo, logo_tipo FROM sirve.partido WHERE id = ?
                """, (rs, n) -> new Logo(rs.getBytes("logo"), rs.getString("logo_tipo")), id)
                .stream().filter(l -> l.datos() != null).findFirst();
    }

    public void guardarLogo(int id, byte[] datos, String tipo) {
        jdbc.update("UPDATE sirve.partido SET logo = ?, logo_tipo = ? WHERE id = ?",
                datos, tipo, id);
    }

    public void borrarLogo(int id) {
        jdbc.update("UPDATE sirve.partido SET logo = NULL, logo_tipo = NULL WHERE id = ?", id);
    }

    /**
     * Copia el logo del partido a sus boletas.
     *
     * Solo donde la boleta no tiene logo: si alguien puso uno distinto en una
     * elección, se respeta. Al revés que el color, aquí no se pisa nada.
     */
    public void propagarLogo(int idPartido, byte[] datos, String tipo) {
        jdbc.update("""
                UPDATE sirve.opcion_boleta
                   SET logo = ?, logo_tipo = ?
                 WHERE id_partido = ? AND logo IS NULL
                """, datos, tipo, idPartido);
    }

    /** Logo de una opción de boleta, para la pantalla pública. */
    public Optional<Logo> logoDeOpcion(int idOpcion) {
        return jdbc.query("""
                SELECT logo, logo_tipo FROM sirve.opcion_boleta WHERE id = ?
                """, (rs, n) -> new Logo(rs.getBytes("logo"), rs.getString("logo_tipo")), idOpcion)
                .stream().filter(l -> l.datos() != null).findFirst();
    }
}
