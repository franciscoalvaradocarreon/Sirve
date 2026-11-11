package mx.sirve.repositorio;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Fotos de acta: la referencia en la base y los datos para nombrar el archivo.
 *
 * El nombre se arma con año, elección, municipio, sección y casilla, para que
 * el archivo se pueda identificar sin abrir la base ni la imagen.
 */
@Repository
public class ActaFotoRepositorio {

    private final JdbcTemplate jdbc;

    public ActaFotoRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Datos para construir el nombre del archivo. */
    public Optional<Map<String, Object>> datos(int idCasilla, int idEleccion) {
        List<Map<String, Object>> filas = jdbc.queryForList("""
                SELECT p.anio            AS anio,
                       e.clave           AS eleccion,
                       m.clave           AS municipio,
                       s.clave           AS seccion,
                       k.clave           AS casilla,
                       k.tipo            AS tipo
                  FROM sirve.casilla         k
                  JOIN sirve.seccion         s ON s.id = k.id_seccion
                  JOIN sirve.municipio       m ON m.id = s.id_municipio
                  JOIN sirve.proceso_electoral p ON p.id = s.id_proceso
                  JOIN sirve.eleccion        e ON e.id = ?
                 WHERE k.id = ?
                """, idEleccion, idCasilla);
        return filas.stream().findFirst();
    }

    public void guardar(int idCasilla, int idEleccion, String ruta, int bytes,
                        Integer idCapturista, Integer idDispositivo) {
        jdbc.update("""
                INSERT INTO sirve.acta_foto
                       (id_casilla, id_eleccion, ruta, bytes, id_capturista, id_dispositivo)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT (id_casilla, id_eleccion) DO UPDATE
                   SET ruta       = EXCLUDED.ruta,
                       bytes      = EXCLUDED.bytes,
                       subida_en  = now(),
                       id_capturista  = EXCLUDED.id_capturista,
                       id_dispositivo = EXCLUDED.id_dispositivo
                """, idCasilla, idEleccion, ruta, bytes, idCapturista, idDispositivo);
    }

    public Optional<Map<String, Object>> buscar(int idCasilla, int idEleccion) {
        List<Map<String, Object>> filas = jdbc.queryForList("""
                SELECT ruta, bytes, subida_en
                  FROM sirve.acta_foto
                 WHERE id_casilla = ? AND id_eleccion = ?
                """, idCasilla, idEleccion);
        return filas.stream().findFirst();
    }

    /** Cuántas fotos hay de una elección. Sirve para el reporte de avance. */
    public int contar(int idEleccion) {
        Integer n = jdbc.queryForObject(
                "SELECT count(*) FROM sirve.acta_foto WHERE id_eleccion = ?",
                Integer.class, idEleccion);
        return n == null ? 0 : n;
    }
}
