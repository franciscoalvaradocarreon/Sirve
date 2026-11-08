package mx.sirve.repositorio;

import mx.sirve.modelo.dto.EleccionDTO;
import mx.sirve.modelo.dto.OpcionBoletaDTO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Elecciones de un proceso y su boleta. */
@Repository
public class EleccionRepositorio {

    private final JdbcTemplate jdbc;

    public EleccionRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<EleccionDTO> FILA = (rs, n) -> new EleccionDTO(
            rs.getInt("id"),
            rs.getString("clave"),
            rs.getString("nombre"),
            rs.getString("tipo"),
            rs.getInt("orden"),
            rs.getBoolean("activa"),
            rs.getInt("casillas"),
            rs.getInt("opciones"),
            rs.getInt("capturadas"));

    private static final RowMapper<OpcionBoletaDTO> FILA_OPCION = (rs, n) -> new OpcionBoletaDTO(
            rs.getInt("id"),
            rs.getString("etiqueta"),
            rs.getString("tipo"),
            rs.getInt("orden"));

    /**
     * Elecciones del proceso con sus conteos.
     *
     * Son subconsultas y no joins para no multiplicar filas: una elección
     * tiene casillas, opciones y capturas en tablas distintas, y unirlas
     * todas daría el producto de las tres.
     */
    public List<EleccionDTO> listarPorProceso(int idProceso) {
        return jdbc.query("""
                SELECT e.id, e.clave, e.nombre, e.tipo::text AS tipo, e.orden, e.activa,
                       (SELECT count(*) FROM sirve.casilla_eleccion ce
                         WHERE ce.id_eleccion = e.id)                    AS casillas,
                       (SELECT count(*) FROM sirve.opcion_boleta ob
                         WHERE ob.id_eleccion = e.id AND ob.activo)      AS opciones,
                       (SELECT count(*) FROM sirve.captura c
                         WHERE c.id_eleccion = e.id)                     AS capturadas
                  FROM sirve.eleccion e
                 WHERE e.id_proceso = ?
                 ORDER BY e.orden
                """, FILA, idProceso);
    }

    public List<OpcionBoletaDTO> opciones(int idEleccion) {
        return jdbc.query("""
                SELECT id, etiqueta, tipo, orden
                  FROM sirve.opcion_boleta
                 WHERE id_eleccion = ? AND activo
                 ORDER BY orden
                """, FILA_OPCION, idEleccion);
    }

    public boolean existe(int id) {
        Integer n = jdbc.queryForObject(
                "SELECT count(*) FROM sirve.eleccion WHERE id = ?", Integer.class, id);
        return n != null && n > 0;
    }
}