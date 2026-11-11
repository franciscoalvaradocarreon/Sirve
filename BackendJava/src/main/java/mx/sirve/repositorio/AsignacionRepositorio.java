package mx.sirve.repositorio;

import mx.sirve.modelo.dto.AsignacionDTO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Reporte de asignación: qué secciones cubre cada capturista y cómo va.
 *
 * El avance se mide contra las casillas de esa sección **en la elección
 * elegida**: una sección puede tener tres casillas en Gobernatura y dos en
 * Ayuntamientos, y comparar contra el total daría un avance falso.
 */
@Repository
public class AsignacionRepositorio {

    private final JdbcTemplate jdbc;

    public AsignacionRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<AsignacionDTO> FILA = (rs, n) -> new AsignacionDTO(
            rs.getInt("id_capturista"),
            rs.getString("capturista"),
            rs.getString("municipio"),
            rs.getString("seccion"),
            rs.getInt("casillas"),
            rs.getInt("capturadas"),
            rs.getInt("otros"));

    public List<AsignacionDTO> listar(int idEleccion) {
        return jdbc.query("""
                SELECT c.id   AS id_capturista,
                       c.nombre AS capturista,
                       m.nombre AS municipio,
                       s.clave  AS seccion,
                       count(k.id)   AS casillas,
                       count(cap.id) AS capturadas,
                       (SELECT count(*) - 1
                          FROM sirve.capturista_seccion cs2
                         WHERE cs2.id_seccion = s.id) AS otros
                  FROM sirve.capturista_seccion cs
                  JOIN sirve.capturista c ON c.id = cs.id_capturista
                  JOIN sirve.seccion     s ON s.id = cs.id_seccion
                  JOIN sirve.municipio   m ON m.id = s.id_municipio
                  LEFT JOIN sirve.casilla k
                         ON k.id_seccion = s.id
                        AND EXISTS (SELECT 1
                                      FROM sirve.casilla_eleccion ce
                                     WHERE ce.id_casilla = k.id
                                       AND ce.id_eleccion = ?)
                  LEFT JOIN sirve.captura cap
                         ON cap.id_casilla = k.id
                        AND cap.id_eleccion = ?
                 GROUP BY c.id, c.nombre, m.nombre, s.id, s.clave
                 ORDER BY c.nombre, m.nombre, length(s.clave), s.clave
                """, FILA, idEleccion, idEleccion);
    }
}
