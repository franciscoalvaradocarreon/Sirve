package mx.sirve.repositorio;

import mx.sirve.modelo.dto.CapturistaDTO;
import mx.sirve.modelo.dto.CasillaAsignadaDTO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Capturistas y las casillas que cubren.
 *
 * La asignación se guarda en una tabla aparte y no como lista en una columna:
 * así se puede preguntar «¿quién cubre esta casilla?» sin recorrer nada.
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
                       count(cc.id_casilla) AS casillas
                  FROM sirve.capturista c
                  LEFT JOIN sirve.capturista_casilla cc ON cc.id_capturista = c.id
                 GROUP BY c.id, c.nombre, c.telefono, c.activo, c.creado_en
                 ORDER BY c.nombre
                """, FILA);
    }

    public Optional<CapturistaDTO> buscar(int id) {
        List<CapturistaDTO> filas = jdbc.query("""
                SELECT c.id, c.nombre, c.telefono, c.activo, c.creado_en,
                       count(cc.id_casilla) AS casillas
                  FROM sirve.capturista c
                  LEFT JOIN sirve.capturista_casilla cc ON cc.id_capturista = c.id
                 WHERE c.id = ?
                 GROUP BY c.id, c.nombre, c.telefono, c.activo, c.creado_en
                """, FILA, id);
        return filas.stream().findFirst();
    }

    public int insertar(String nombre, String telefono, boolean activo) {
        Integer id = jdbc.queryForObject("""
                INSERT INTO sirve.capturista (nombre, telefono, activo)
                VALUES (?, ?, ?)
                RETURNING id
                """, Integer.class, nombre, telefono, activo);
        return id == null ? 0 : id;
    }

    public void actualizar(int id, String nombre, String telefono, boolean activo) {
        jdbc.update("""
                UPDATE sirve.capturista SET nombre = ?, telefono = ?, activo = ?
                 WHERE id = ?
                """, nombre, telefono, activo, id);
    }

    public void eliminar(int id) {
        jdbc.update("DELETE FROM sirve.capturista WHERE id = ?", id);
    }

    /** Reemplaza la asignación completa. */
    public void asignar(int idCapturista, List<Integer> casillas) {
        jdbc.update("DELETE FROM sirve.capturista_casilla WHERE id_capturista = ?", idCapturista);
        for (Integer idCasilla : casillas) {
            jdbc.update("""
                    INSERT INTO sirve.capturista_casilla (id_capturista, id_casilla)
                    VALUES (?, ?) ON CONFLICT DO NOTHING
                    """, idCapturista, idCasilla);
        }
    }

    /**
     * Casillas del capturista en una elección, con su estado de captura.
     *
     * El estado sale de la captura de esa elección, no de un campo guardado:
     * si se recaptura o se borra, esto lo refleja solo.
     */
    public List<CasillaAsignadaDTO> casillas(int idCapturista, int idEleccion) {
        return jdbc.query("""
                SELECT k.id, k.clave, k.tipo, s.clave AS seccion, m.nombre AS municipio,
                       (c.id IS NOT NULL) AS capturada
                  FROM sirve.capturista_casilla cc
                  JOIN sirve.casilla  k ON k.id = cc.id_casilla
                  JOIN sirve.seccion  s ON s.id = k.id_seccion
                  JOIN sirve.municipio m ON m.id = s.id_municipio
                  LEFT JOIN sirve.captura c
                         ON c.id_casilla = k.id AND c.id_eleccion = ?
                 WHERE cc.id_capturista = ?
                 ORDER BY m.nombre, length(s.clave), s.clave, k.clave
                """, CASILLA, idEleccion, idCapturista);
    }

    /** ¿Esta casilla está asignada a este capturista? */
    public boolean cubre(int idCapturista, int idCasilla) {
        Integer n = jdbc.queryForObject("""
                SELECT count(*) FROM sirve.capturista_casilla
                 WHERE id_capturista = ? AND id_casilla = ?
                """, Integer.class, idCapturista, idCasilla);
        return n != null && n > 0;
    }

    /** Todos los identificadores asignados, para pintar la lista completa. */
    public List<Integer> casillasAsignadas(int idCapturista) {
        return jdbc.queryForList("""
                SELECT id_casilla FROM sirve.capturista_casilla WHERE id_capturista = ?
                """, Integer.class, idCapturista);
    }
}
