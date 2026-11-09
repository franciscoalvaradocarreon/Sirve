package mx.sirve.repositorio;

import mx.sirve.modelo.dto.SeccionDTO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Secciones de un proceso, opcionalmente acotadas a un municipio. */
@Repository
public class SeccionRepositorio {

    private final JdbcTemplate jdbc;

    public SeccionRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<SeccionDTO> FILA = (rs, n) -> new SeccionDTO(
            rs.getInt("id"),
            rs.getInt("id_municipio"),
            rs.getString("clave"),
            rs.getString("municipio"),
            rs.getInt("casillas"),
            rs.getString("distrito_local"),
            rs.getString("distrito_federal"));

    /**
     * Secciones con su municipio, su número de casillas y sus distritos.
     *
     * idMunicipio nulo devuelve todas las del proceso. Se compara con
     * (?::int IS NULL OR ...) en lugar de armar dos consultas: el plan es el
     * mismo y el código no se duplica.
     *
     * Los distritos son LEFT JOIN porque una sección puede no tenerlos: el
     * proceso 2021 no tiene cartografía federal cargada.
     */
    public List<SeccionDTO> listar(Integer idMunicipio, int idProceso) {
        return jdbc.query("""
                SELECT s.id, m.id AS id_municipio, s.clave, m.nombre AS municipio,
                       count(k.id) AS casillas,
                       dl.clave AS distrito_local,
                       df.clave AS distrito_federal
                  FROM sirve.seccion s
                  JOIN sirve.municipio m ON m.id = s.id_municipio
                  LEFT JOIN sirve.casilla  k  ON k.id_seccion = s.id
                  LEFT JOIN sirve.distrito dl ON dl.id = s.id_distrito_local
                  LEFT JOIN sirve.distrito df ON df.id = s.id_distrito_federal
                 WHERE s.id_proceso = ?
                   AND (?::int IS NULL OR s.id_municipio = ?::int)
                 GROUP BY s.id, m.id, s.clave, m.nombre, dl.clave, df.clave
                 ORDER BY m.nombre, length(s.clave), s.clave
                """, FILA, idProceso, idMunicipio, idMunicipio);
    }
}