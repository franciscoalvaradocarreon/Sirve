package mx.sirve.repositorio;

import mx.sirve.modelo.dto.CapturistaDTO;
import mx.sirve.modelo.dto.CasillaAsignadaDTO;
import mx.sirve.modelo.dto.SeccionAsignadaDTO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Capturistas y las secciones que cubren.
 *
 * La asignación es por sección: de cada una salen todas sus casillas. Es como
 * se reparte el trabajo en campo y evita tener que ir casilla por casilla.
 */
@Repository
public class CapturistaRepositorio {

    private final JdbcTemplate jdbc;

    public CapturistaRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<CapturistaDTO> FILA = (rs, n) -> new CapturistaDTO(
            rs.getInt("id"),
            rs.getString("nombre"),
            rs.getString("telefono"),
            rs.getBoolean("activo"),
            rs.getInt("casillas"),
            List.of(),
            rs.getObject("creado_en", java.time.OffsetDateTime.class));

    private static final RowMapper<SeccionAsignadaDTO> SECCION = (rs, n) -> new SeccionAsignadaDTO(
            rs.getInt("id"),
            rs.getString("clave"),
            rs.getString("municipio"),
            rs.getInt("casillas"));

    private static final RowMapper<CasillaAsignadaDTO> CASILLA = (rs, n) -> new CasillaAsignadaDTO(
            rs.getInt("id"),
            rs.getString("clave"),
            rs.getString("tipo"),
            rs.getString("seccion"),
            rs.getString("municipio"),
            rs.getBoolean("capturada"));

    public List<CapturistaDTO> listar() {
        return jdbc.query("""
                SELECT c.id, c.nombre, c.telefono, c.activo, c.creado_en,
                       coalesce(sum(k.casillas), 0) AS casillas
                  FROM sirve.capturista c
                  LEFT JOIN sirve.capturista_seccion cs ON cs.id_capturista = c.id
                  LEFT JOIN (
                        SELECT id_seccion, count(*) AS casillas
                          FROM sirve.casilla GROUP BY id_seccion
                  ) k ON k.id_seccion = cs.id_seccion
                 GROUP BY c.id, c.nombre, c.telefono, c.activo, c.creado_en
                 ORDER BY c.nombre
                """, FILA);
    }

    public Optional<CapturistaDTO> buscar(int id) {
        List<CapturistaDTO> filas = jdbc.query("""
                SELECT c.id, c.nombre, c.telefono, c.activo, c.creado_en,
                       coalesce(sum(k.casillas), 0) AS casillas
                  FROM sirve.capturista c
                  LEFT JOIN sirve.capturista_seccion cs ON cs.id_capturista = c.id
                  LEFT JOIN (
                        SELECT id_seccion, count(*) AS casillas
                          FROM sirve.casilla GROUP BY id_seccion
                  ) k ON k.id_seccion = cs.id_seccion
                 WHERE c.id = ?
                 GROUP BY c.id, c.nombre, c.telefono, c.activo, c.creado_en
                """, FILA, id);
        return filas.stream().findFirst();
    }

    public int insertar(String nombre, String telefono, boolean activo) {
        Integer id = jdbc.queryForObject("""
                INSERT INTO sirve.capturista (nombre, telefono, activo)
                VALUES (?, ?, ?) RETURNING id
                """, Integer.class, nombre, telefono, activo);
        return id == null ? 0 : id;
    }

    public void actualizar(int id, String nombre, String telefono, boolean activo) {
        jdbc.update("""
                UPDATE sirve.capturista SET nombre = ?, telefono = ?, activo = ? WHERE id = ?
                """, nombre, telefono, activo, id);
    }

    public void eliminar(int id) {
        jdbc.update("DELETE FROM sirve.capturista WHERE id = ?", id);
    }

    /** Reemplaza la asignación completa de secciones. */
    public void asignarSecciones(int idCapturista, List<Integer> secciones) {
        jdbc.update("DELETE FROM sirve.capturista_seccion WHERE id_capturista = ?", idCapturista);
        for (Integer idSeccion : secciones) {
            jdbc.update("""
                    INSERT INTO sirve.capturista_seccion (id_capturista, id_seccion)
                    VALUES (?, ?) ON CONFLICT DO NOTHING
                    """, idCapturista, idSeccion);
        }
    }

    public List<SeccionAsignadaDTO> secciones(int idCapturista) {
        return jdbc.query("""
                SELECT s.id, s.clave, m.nombre AS municipio, count(k.id) AS casillas
                  FROM sirve.capturista_seccion cs
                  JOIN sirve.seccion   s ON s.id = cs.id_seccion
                  JOIN sirve.municipio m ON m.id = s.id_municipio
                  LEFT JOIN sirve.casilla k ON k.id_seccion = s.id
                 WHERE cs.id_capturista = ?
                 GROUP BY s.id, s.clave, m.nombre
                 ORDER BY m.nombre, length(s.clave), s.clave
                """, SECCION, idCapturista);
    }

    /**
     * Casillas del capturista en una elección, con su estado de captura.
     *
     * Solo aparecen las declaradas en `casilla_eleccion`: una casilla que no
     * participa en esa elección no se puede capturar y no tiene caso mostrarla.
     */
    public List<CasillaAsignadaDTO> casillas(int idCapturista, int idEleccion) {
        return jdbc.query("""
                SELECT k.id, k.clave, k.tipo, s.clave AS seccion, m.nombre AS municipio,
                       (c.id IS NOT NULL) AS capturada
                  FROM sirve.capturista_seccion cs
                  JOIN sirve.seccion   s ON s.id = cs.id_seccion
                  JOIN sirve.casilla   k ON k.id_seccion = s.id
                  JOIN sirve.municipio m ON m.id = s.id_municipio
                  JOIN sirve.casilla_eleccion ce
                       ON ce.id_casilla = k.id AND ce.id_eleccion = ?
                  LEFT JOIN sirve.captura c
                         ON c.id_casilla = k.id AND c.id_eleccion = ?
                 WHERE cs.id_capturista = ?
                 ORDER BY m.nombre, length(s.clave), s.clave, k.clave
                """, CASILLA, idEleccion, idEleccion, idCapturista);
    }

    /** ¿La casilla cae en alguna sección de este capturista? */
    public boolean cubre(int idCapturista, int idCasilla) {
        Integer n = jdbc.queryForObject("""
                SELECT count(*)
                  FROM sirve.capturista_seccion cs
                  JOIN sirve.casilla k ON k.id_seccion = cs.id_seccion
                 WHERE cs.id_capturista = ? AND k.id = ?
                """, Integer.class, idCapturista, idCasilla);
        return n != null && n > 0;
    }
}
