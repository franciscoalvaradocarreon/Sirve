package mx.sirve.repositorio;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Catálogo de coaliciones del proceso activo.
 *
 * Igual que los partidos, la coalición tiene nombre, color y logo. La
 * diferencia es que una coalición pertenece a un proceso electoral: se arma
 * para una jornada y no se reutiliza en la siguiente, aunque se llame igual.
 *
 * Los integrantes salen de coalicion_partido y se muestran juntos —«PAN + PRI +
 * PRD»—, que es lo que un coordinador reconoce; la clave sola no dice nada.
 */
@Repository
public class CoalicionRepositorio {

    public record Coalicion(int id, String clave, String nombre, String color,
                            boolean activa, boolean tieneLogo, String integrantes) {
    }

    public record Logo(byte[] datos, String tipo) {
    }

    private final JdbcTemplate jdbc;

    public CoalicionRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<Coalicion> FILA = (rs, n) -> new Coalicion(
            rs.getInt("id"),
            rs.getString("clave"),
            rs.getString("nombre"),
            rs.getString("color"),
            rs.getBoolean("activa"),
            rs.getBytes("logo") != null,
            rs.getString("integrantes"));

    /** Coaliciones del proceso electoral activo. */
    public List<Coalicion> listar() {
        return jdbc.query("""
                SELECT c.id, c.clave, c.nombre, c.color, c.activa, c.logo,
                       coalesce((SELECT string_agg(p.clave, ' + ' ORDER BY p.orden)
                                   FROM sirve.coalicion_partido cp
                                   JOIN sirve.partido p ON p.id = cp.id_partido
                                  WHERE cp.id_coalicion = c.id), '') AS integrantes
                  FROM sirve.coalicion c
                  JOIN sirve.proceso_electoral pr ON pr.id = c.id_proceso
                 WHERE pr.activo
                 ORDER BY length(c.clave), c.clave
                """, FILA);
    }

    public Optional<Coalicion> buscar(int id) {
        return jdbc.query("""
                SELECT c.id, c.clave, c.nombre, c.color, c.activa, c.logo,
                       coalesce((SELECT string_agg(p.clave, ' + ' ORDER BY p.orden)
                                   FROM sirve.coalicion_partido cp
                                   JOIN sirve.partido p ON p.id = cp.id_partido
                                  WHERE cp.id_coalicion = c.id), '') AS integrantes
                  FROM sirve.coalicion c
                 WHERE c.id = ?
                """, FILA, id).stream().findFirst();
    }

    public void actualizar(int id, String nombre, String color, boolean activa) {
        jdbc.update("UPDATE sirve.coalicion SET nombre = ?, color = ?, activa = ? WHERE id = ?",
                nombre, color, activa, id);
    }

    /** Copia el color a las boletas de las elecciones donde aparece. */
    public void propagarColor(int idCoalicion, String color) {
        jdbc.update("UPDATE sirve.opcion_boleta SET color = ? WHERE id_coalicion = ?",
                color, idCoalicion);
    }

    public Optional<Logo> logo(int id) {
        return jdbc.query("SELECT logo, logo_tipo FROM sirve.coalicion WHERE id = ?",
                (rs, n) -> new Logo(rs.getBytes("logo"), rs.getString("logo_tipo")), id)
                .stream().filter(l -> l.datos() != null).findFirst();
    }

    public void guardarLogo(int id, byte[] datos, String tipo) {
        jdbc.update("UPDATE sirve.coalicion SET logo = ?, logo_tipo = ? WHERE id = ?",
                datos, tipo, id);
    }

    public void borrarLogo(int id) {
        jdbc.update("UPDATE sirve.coalicion SET logo = NULL, logo_tipo = NULL WHERE id = ?", id);
    }

    /** El logo se copia a las boletas, sin pisar el que ya tuvieran. */
    public void propagarLogo(int idCoalicion, byte[] datos, String tipo) {
        jdbc.update("""
                UPDATE sirve.opcion_boleta
                   SET logo = ?, logo_tipo = ?
                 WHERE id_coalicion = ? AND logo IS NULL
                """, datos, tipo, idCoalicion);
    }
}
