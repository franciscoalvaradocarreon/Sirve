package mx.sirve.repositorio;

import mx.sirve.modelo.dto.DistritoDTO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Distritos electorales, locales o federales. */
@Repository
public class DistritoRepositorio {

    private final JdbcTemplate jdbc;

    public DistritoRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<DistritoDTO> FILA = (rs, n) -> new DistritoDTO(
            rs.getInt("id"),
            rs.getString("clave"),
            rs.getString("nombre"),
            rs.getString("tipo"),
            rs.getInt("secciones"));

    /**
     * Distritos de un tipo, con cuántas secciones de ese proceso les tocan.
     *
     * El LEFT JOIN lleva la condición de proceso y de tipo dentro del ON: si
     * fuera en el WHERE, los distritos sin secciones desaparecerían y un
     * proceso nuevo aparecería vacío en lugar de mostrar los distritos en 0.
     */
    public List<DistritoDTO> listar(String tipo, int idProceso) {
        return jdbc.query("""
                SELECT d.id, d.clave, d.nombre, d.tipo::text AS tipo,
                       count(s.id) AS secciones
                  FROM sirve.distrito d
                  LEFT JOIN sirve.seccion s
                    ON s.id_proceso = ?
                   AND ((d.tipo = 'LOCAL'   AND s.id_distrito_local   = d.id)
                     OR (d.tipo = 'FEDERAL' AND s.id_distrito_federal = d.id))
                 WHERE d.tipo = ?::sirve.tipo_distrito
                 GROUP BY d.id, d.clave, d.nombre, d.tipo
                 ORDER BY d.clave
                """, FILA, idProceso, tipo);
    }
}