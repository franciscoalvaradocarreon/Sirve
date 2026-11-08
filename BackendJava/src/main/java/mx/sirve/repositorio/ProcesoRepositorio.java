package mx.sirve.repositorio;

import mx.sirve.modelo.dto.ProcesoDTO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Procesos electorales. */
@Repository
public class ProcesoRepositorio {

    private final JdbcTemplate jdbc;

    public ProcesoRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<ProcesoDTO> FILA = (rs, n) -> new ProcesoDTO(
            rs.getInt("id"),
            rs.getInt("anio"),
            rs.getString("nombre"),
            rs.getString("estado"),
            rs.getBoolean("activo"),
            rs.getString("fecha_jornada"),
            rs.getString("entidad"));

    public List<ProcesoDTO> listar() {
        // fecha_jornada es date: se devuelve como texto 'YYYY-MM-DD' porque el
        // driver la entrega como java.sql.Date y Jackson la serializaría como
        // marca de tiempo (2024-06-02T06:00:00Z), que no es lo que pide el contrato.
        return jdbc.query("""
                SELECT p.id, p.anio, p.nombre, p.estado, p.activo,
                       to_char(p.fecha_jornada, 'YYYY-MM-DD') AS fecha_jornada,
                       e.clave AS entidad
                  FROM sirve.proceso_electoral p
                  JOIN sirve.entidad e ON e.id = p.id_entidad
                 ORDER BY p.activo DESC, p.anio DESC
                """, FILA);
    }

    public boolean existe(int id) {
        Integer n = jdbc.queryForObject(
                "SELECT count(*) FROM sirve.proceso_electoral WHERE id = ?", Integer.class, id);
        return n != null && n > 0;
    }
}
