package mx.sirve.repositorio;

import mx.sirve.modelo.dto.DispositivoDTO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Teléfonos enrolados.
 *
 * Todo lo que se guarda de un pase es su hash: el valor en claro nunca llega
 * a la base. Lo que se busca por hash es el pase que trae la petición.
 */
@Repository
public class DispositivoRepositorio {

    private final JdbcTemplate jdbc;

    public DispositivoRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<DispositivoDTO> FILA = (rs, n) -> new DispositivoDTO(
            rs.getInt("id"),
            rs.getString("nombre"),
            rs.getBoolean("activo"),
            rs.getObject("pase_hash") != null,
            rs.getObject("enrolado_en", java.time.OffsetDateTime.class),
            rs.getObject("ultimo_uso", java.time.OffsetDateTime.class));

    /** Alta de un dispositivo con su código de enrolamiento, ya hasheado. */
    public int crear(int idCapturista, String nombre, String codigoHash) {
        Integer id = jdbc.queryForObject("""
                INSERT INTO sirve.dispositivo (id_capturista, nombre, codigo_hash)
                VALUES (?, ?, ?)
                RETURNING id
                """, Integer.class, idCapturista, nombre, codigoHash);
        return id == null ? 0 : id;
    }

    /**
     * Un teléfono del capturista que todavía no se enrola.
     *
     * Sirve para no acumular registros: si se pide un código y ya hay uno
     * pendiente, se reemite ese en lugar de crear otro.
     */
    public Optional<Integer> sinEnrolar(int idCapturista) {
        List<Integer> ids = jdbc.queryForList("""
                SELECT id FROM sirve.dispositivo
                 WHERE id_capturista = ? AND activo AND pase_hash IS NULL
                 ORDER BY creado_en
                 LIMIT 1
                """, Integer.class, idCapturista);
        return ids.stream().findFirst();
    }

    /**
     * Borra los teléfonos pendientes sobrantes, dejando uno.
     *
     * Son registros de códigos generados y nunca usados. Sin esto, cada prueba
     * deja un teléfono vacío en la lista para siempre.
     */
    public void depurarSinEnrolar(int idCapturista, int conservar) {
        jdbc.update("""
                DELETE FROM sirve.dispositivo
                 WHERE id_capturista = ? AND pase_hash IS NULL AND id <> ?
                """, idCapturista, conservar);
    }

    /**
     * Cuántos teléfonos están enrolados y activos.
     *
     * Se cuentan los enrolados, no los códigos generados: un código repartido
     * que nadie usó todavía no es un teléfono en operación.
     */
    public int enrolados(int idCapturista) {
        Integer n = jdbc.queryForObject("""
                SELECT count(*) FROM sirve.dispositivo
                 WHERE id_capturista = ? AND activo AND pase_hash IS NOT NULL
                """, Integer.class, idCapturista);
        return n == null ? 0 : n;
    }

    public List<DispositivoDTO> listar(int idCapturista) {
        return jdbc.query("""
                SELECT id, nombre, activo, pase_hash, enrolado_en, ultimo_uso
                  FROM sirve.dispositivo
                 WHERE id_capturista = ?
                 ORDER BY creado_en
                """, FILA, idCapturista);
    }

    /**
     * Busca el dispositivo por el hash del pase y devuelve [idDispositivo,
     * idCapturista] si está activo y ya enrolado.
     */
    public Optional<int[]> porPase(String paseHash) {
        List<int[]> filas = jdbc.query("""
                SELECT id, id_capturista
                  FROM sirve.dispositivo
                 WHERE pase_hash = ? AND activo
                """, (rs, n) -> new int[]{rs.getInt("id"), rs.getInt("id_capturista")}, paseHash);
        return filas.stream().findFirst();
    }

    /** Dispositivo pendiente de enrolar, con el código que trae el capturista. */
    public Optional<int[]> porCodigo(String codigoHash) {
        List<int[]> filas = jdbc.query("""
                SELECT id, id_capturista
                  FROM sirve.dispositivo
                 WHERE codigo_hash = ? AND activo AND pase_hash IS NULL
                """, (rs, n) -> new int[]{rs.getInt("id"), rs.getInt("id_capturista")}, codigoHash);
        return filas.stream().findFirst();
    }

    /** Guarda el pase y consume el código: el código no se puede reutilizar. */
    public void enrolar(int idDispositivo, String paseHash) {
        jdbc.update("""
                UPDATE sirve.dispositivo
                   SET pase_hash = ?, enrolado_en = now(), ultimo_uso = now()
                 WHERE id = ?
                """, paseHash, idDispositivo);
    }

    public void tocar(int idDispositivo) {
        jdbc.update("UPDATE sirve.dispositivo SET ultimo_uso = now() WHERE id = ?", idDispositivo);
    }

    public void desactivar(int idDispositivo) {
        jdbc.update("UPDATE sirve.dispositivo SET activo = false WHERE id = ?", idDispositivo);
    }

    /** Reemite el código: borra el pase y deja uno nuevo pendiente de usar. */
    public void reemitir(int idDispositivo, String codigoHash) {
        jdbc.update("""
                UPDATE sirve.dispositivo
                   SET codigo_hash = ?, pase_hash = NULL, enrolado_en = NULL, activo = true
                 WHERE id = ?
                """, codigoHash, idDispositivo);
    }
}
