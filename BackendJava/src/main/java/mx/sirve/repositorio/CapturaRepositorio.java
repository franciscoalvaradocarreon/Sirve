package mx.sirve.repositorio;

import mx.sirve.modelo.dto.CapturaDTO;
import mx.sirve.modelo.dto.OpcionBoletaDTO;
import mx.sirve.modelo.dto.VotoDTO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Capturas y sus votos.
 *
 * La escritura son tres sentencias que el servicio envuelve en una
 * transacción: alta o reemplazo, borrado del detalle anterior y alta del
 * nuevo detalle.
 */
@Repository
public class CapturaRepositorio {

    private final JdbcTemplate jdbc;

    public CapturaRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<CapturaDTO> FILA = (rs, n) -> new CapturaDTO(
            rs.getLong("id"),
            rs.getInt("id_casilla"),
            rs.getInt("id_eleccion"),
            rs.getInt("total_acta"),
            rs.getInt("no_registrados"),
            rs.getInt("nulos"),
            rs.getInt("suma_opciones"),
            rs.getInt("diferencia"),
            rs.getBoolean("aritmetica_ok"),
            rs.getObject("recibida_en", java.time.OffsetDateTime.class));

    public Optional<CapturaDTO> buscar(int idCasilla, int idEleccion) {
        List<CapturaDTO> filas = jdbc.query("""
                SELECT id, id_casilla, id_eleccion, total_acta, no_registrados,
                       nulos, suma_opciones, diferencia, aritmetica_ok, recibida_en
                  FROM sirve.captura
                 WHERE id_casilla = ? AND id_eleccion = ?
                """, FILA, idCasilla, idEleccion);
        return filas.stream().findFirst();
    }

    public Optional<Long> buscarPorCliente(String idCliente) {
        List<Long> ids = jdbc.queryForList(
                "SELECT id FROM sirve.captura WHERE id_cliente = ?::uuid", Long.class, idCliente);
        return ids.stream().findFirst();
    }

    /**
     * Alta o reemplazo de la cabecera.
     *
     * El conflicto se declara por columnas y no por nombre de restricción: si
     * mañana cambia el nombre del índice, esto sigue funcionando.
     */
    public long guardarCabecera(String idCliente, int idCasilla, int idEleccion,
                                int totalActa, int noRegistrados, int nulos,
                                int sumaOpciones, String autorTexto) {
        Long id = jdbc.queryForObject("""
                INSERT INTO sirve.captura (id_cliente, id_casilla, id_eleccion, total_acta,
                                           no_registrados, nulos, suma_opciones, autor_texto)
                VALUES (?::uuid, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (id_casilla, id_eleccion) DO UPDATE
                   SET total_acta     = EXCLUDED.total_acta,
                       no_registrados = EXCLUDED.no_registrados,
                       nulos          = EXCLUDED.nulos,
                       suma_opciones  = EXCLUDED.suma_opciones,
                       autor_texto    = EXCLUDED.autor_texto,
                       recibida_en    = now()
                RETURNING id
                """, Long.class,
                idCliente, idCasilla, idEleccion, totalActa, noRegistrados, nulos,
                sumaOpciones, autorTexto);
        return id == null ? 0L : id;
    }

    public void borrarVotos(long idCaptura) {
        jdbc.update("DELETE FROM sirve.captura_voto WHERE id_captura = ?", idCaptura);
    }

    public void guardarVotos(long idCaptura, List<VotoDTO> votos) {
        jdbc.batchUpdate(
                "INSERT INTO sirve.captura_voto (id_captura, id_opcion, votos) VALUES (?, ?, ?)",
                votos.stream()
                        .map(v -> new Object[] { idCaptura, v.idOpcion(), v.votos() })
                        .toList());
    }

    public List<VotoDTO> votos(long idCaptura) {
        return jdbc.query("""
                SELECT v.id_opcion, v.votos
                  FROM sirve.captura_voto v
                  JOIN sirve.opcion_boleta o ON o.id = v.id_opcion
                 WHERE v.id_captura = ?
                 ORDER BY o.orden
                """, (rs, n) -> new VotoDTO(rs.getInt("id_opcion"), rs.getInt("votos")),
                idCaptura);
    }

    /** Opciones que sí pertenecen a la elección: sirve para validar el cuerpo. */
    public List<OpcionBoletaDTO> opcionesDeLaEleccion(int idEleccion, List<Integer> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return jdbc.query("""
                SELECT id, etiqueta, tipo, orden
                  FROM sirve.opcion_boleta
                 WHERE id_eleccion = ? AND id = ANY (?)
                """, (rs, n) -> new OpcionBoletaDTO(
                        rs.getInt("id"),
                        rs.getString("etiqueta"),
                        rs.getString("tipo"),
                        rs.getInt("orden")),
                idEleccion, ids.toArray(new Integer[0]));
    }
}
