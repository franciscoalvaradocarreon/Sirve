package mx.sirve.repositorio;

import mx.sirve.modelo.dto.MunicipioDTO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Municipios con secciones en un proceso. */
@Repository
public class MunicipioRepositorio {

    private final JdbcTemplate jdbc;

    public MunicipioRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<MunicipioDTO> FILA = (rs, n) -> new MunicipioDTO(
            rs.getInt("id"),
            rs.getString("clave"),
            rs.getString("nombre"),
            rs.getInt("secciones"));

    public List<MunicipioDTO> listarPorProceso(int idProceso) {
        return jdbc.query("""
                SELECT m.id, m.clave, m.nombre, count(s.id) AS secciones
                  FROM sirve.municipio m
                  JOIN sirve.seccion s ON s.id_municipio = m.id AND s.id_proceso = ?
                 GROUP BY m.id, m.clave, m.nombre
                 ORDER BY m.nombre
                """, FILA, idProceso);
    }
}