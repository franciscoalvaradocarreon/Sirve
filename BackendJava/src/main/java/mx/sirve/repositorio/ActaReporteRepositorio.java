package mx.sirve.repositorio;

import mx.sirve.modelo.dto.ActaReporteDTO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Reporte de actas con foto.
 *
 * Solo aparecen las casillas que **ya tienen** una foto registrada: es una
 * lista de lo que existe, no de lo que falta. Para lo que falta está el
 * reporte de avance.
 */
@Repository
public class ActaReporteRepositorio {

    private final JdbcTemplate jdbc;

    public ActaReporteRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<ActaReporteDTO> FILA = (rs, n) -> new ActaReporteDTO(
            rs.getInt("id_casilla"),
            rs.getString("municipio"),
            rs.getString("seccion"),
            rs.getString("casilla"),
            rs.getString("ruta"),
            rs.getInt("bytes"),
            rs.getObject("subida_en", java.time.OffsetDateTime.class),
            rs.getString("capturista"));

    public List<ActaReporteDTO> listar(int idEleccion) {
        return jdbc.query("""
                SELECT a.id_casilla,
                       m.nombre AS municipio,
                       s.clave  AS seccion,
                       k.clave  AS casilla,
                       a.ruta,
                       a.bytes,
                       a.subida_en,
                       c.nombre AS capturista
                  FROM sirve.acta_foto a
                  JOIN sirve.casilla   k ON k.id = a.id_casilla
                  JOIN sirve.seccion   s ON s.id = k.id_seccion
                  JOIN sirve.municipio m ON m.id = s.id_municipio
                  LEFT JOIN sirve.capturista c ON c.id = a.id_capturista
                 WHERE a.id_eleccion = ?
                 ORDER BY m.nombre, length(s.clave), s.clave, k.clave
                """, FILA, idEleccion);
    }
}