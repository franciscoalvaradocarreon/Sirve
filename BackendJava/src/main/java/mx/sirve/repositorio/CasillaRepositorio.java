package mx.sirve.repositorio;

import mx.sirve.modelo.dto.CasillaDTO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Casillas de una elección, con filtros opcionales. */
@Repository
public class CasillaRepositorio {

    private final JdbcTemplate jdbc;

    public CasillaRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<CasillaDTO> FILA = (rs, n) -> new CasillaDTO(
            rs.getInt("id"),
            rs.getString("clave"),
            rs.getString("tipo"),
            rs.getString("direccion"),
            rs.getString("ubicacion"),
            rs.getString("seccion"),
            rs.getString("municipio"),
            rs.getString("distrito_local"),
            rs.getString("distrito_federal"),
            rs.getBoolean("capturada"),
            (Integer) rs.getObject("total_acta"),
            (Boolean) rs.getObject("aritmetica_ok"));

    /**
     * Casillas declaradas para una elección.
     *
     * Todos los filtros son opcionales y se comparan con (? IS NULL OR ...).
     * una sola consulta sirve para «todas», para una sección concreta y para
     * cualquier combinación de municipio y distritos.
     *
     * El proceso sale de la elección, no de un parámetro aparte: una casilla
     * de otro proceso no puede pertenecer a esta elección.
     */
    public List<CasillaDTO> listar(int idEleccion, Integer idMunicipio, String seccion,
                                   String distritoLocal, String distritoFederal) {
        return jdbc.query("""
                SELECT k.id, k.clave, k.tipo, k.direccion, k.ubicacion,
                       s.clave AS seccion,
                       m.nombre AS municipio,
                       dl.clave AS distrito_local,
                       df.clave AS distrito_federal,
                       (c.id IS NOT NULL) AS capturada,
                       c.total_acta,
                       c.aritmetica_ok
                  FROM sirve.casilla_eleccion ce
                  JOIN sirve.casilla  k  ON k.id = ce.id_casilla
                  JOIN sirve.seccion  s  ON s.id = k.id_seccion
                  JOIN sirve.municipio m ON m.id = s.id_municipio
                  JOIN sirve.distrito dl ON dl.id = s.id_distrito_local
                  LEFT JOIN sirve.distrito df ON df.id = s.id_distrito_federal
                  LEFT JOIN sirve.captura  c  ON c.id_casilla = k.id
                                             AND c.id_eleccion = ce.id_eleccion
                 WHERE ce.id_eleccion = ?
                   AND s.id_proceso = (SELECT id_proceso FROM sirve.eleccion WHERE id = ?)
                   AND (?::int  IS NULL OR s.id_municipio = ?::int)
                   AND (?::text IS NULL OR s.clave = ?::text)
                   AND (?::text IS NULL OR dl.clave = ?::text)
                   AND (?::text IS NULL OR df.clave = ?::text)
                 ORDER BY m.nombre, length(s.clave), s.clave,
                          CASE k.tipo
                            WHEN 'B' THEN 1
                            WHEN 'C1' THEN 2 WHEN 'C2' THEN 3 WHEN 'C3' THEN 4
                            WHEN 'C4' THEN 5 WHEN 'C5' THEN 6 WHEN 'C6' THEN 7
                            WHEN 'C7' THEN 8 WHEN 'C8' THEN 9
                            ELSE 10 END, k.tipo
                """, FILA,
                idEleccion, idEleccion, idMunicipio, idMunicipio,
                seccion, seccion, distritoLocal, distritoLocal,
                distritoFederal, distritoFederal);
    }
}