package mx.sirve.repositorio;

import mx.sirve.modelo.dto.AvanceDTO;
import mx.sirve.modelo.dto.AvanceResumenDTO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Reporte de avance: casillas que le tocan a cada municipio o distrito en una
 * elección, y cuántas de esas ya tienen captura.
 *
 * El universo no son todas las casillas del proceso, sino las que declara
 * `casilla_eleccion`. Es la diferencia que importa: en 2024, diputaciones
 * tiene 7 485 casillas y ayuntamientos 7 440, y comparar contra el total del
 * proceso daría un avance falso.
 *
 * El conteo usa LEFT JOIN contra `captura`, así que una casilla sin acta
 * cuenta en el denominador y no en el numerador.
 */
@Repository
public class AvanceRepositorio {

    private final JdbcTemplate jdbc;

    public AvanceRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<AvanceDTO> FILA = (rs, n) -> new AvanceDTO(
            rs.getInt("id"),
            rs.getString("clave"),
            rs.getString("nombre"),
            rs.getInt("casillas"),
            rs.getInt("capturadas"));

    /**
     * Agrupaciones admitidas. La tabla y la columna se interpolan en el SQL,
     * así que solo pueden venir de aquí: nunca de la petición.
     */
    public enum Agrupacion {
        MUNICIPIO("sirve.municipio", "s.id_municipio"),
        DISTRITO_LOCAL("sirve.distrito", "s.id_distrito_local"),
        DISTRITO_FEDERAL("sirve.distrito", "s.id_distrito_federal");

        private final String tabla;
        private final String columna;

        Agrupacion(String tabla, String columna) {
            this.tabla = tabla;
            this.columna = columna;
        }

        public String etiqueta() {
            return name().toLowerCase();
        }
    }

    public AvanceResumenDTO resumir(int idEleccion, Agrupacion agrupacion) {
        String sql = """
                SELECT g.id,
                       g.clave,
                       g.nombre,
                       count(*)      AS casillas,
                       count(c.id)   AS capturadas
                  FROM sirve.casilla_eleccion ce
                  JOIN sirve.casilla   k ON k.id = ce.id_casilla
                  JOIN sirve.seccion   s ON s.id = k.id_seccion
                  JOIN %s              g ON g.id = %s
                  LEFT JOIN sirve.captura c
                         ON c.id_casilla  = ce.id_casilla
                        AND c.id_eleccion = ce.id_eleccion
                 WHERE ce.id_eleccion = ?
                   AND g.id IS NOT NULL
                 GROUP BY g.id, g.clave, g.nombre
                 ORDER BY g.clave
                """.formatted(agrupacion.tabla, agrupacion.columna);

        List<AvanceDTO> filas = jdbc.query(sql, FILA, idEleccion);

        int casillas = filas.stream().mapToInt(AvanceDTO::casillas).sum();
        int capturadas = filas.stream().mapToInt(AvanceDTO::capturadas).sum();

        return new AvanceResumenDTO(agrupacion.etiqueta(), casillas, capturadas, filas);
    }
}
