package mx.sirve.repositorio;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Parámetros de la aplicación.
 *
 * Son los ajustes que cambian sin desplegar: encender la sala de resultados, el
 * plazo de los códigos, los límites de peticiones.
 *
 * Se leen de la base y no de variables de entorno porque cambiarlas obligaba a
 * entrar al servidor y reiniciar. Apagar la sala a media jornada con un
 * reinicio de contenedor es demasiado para un interruptor.
 */
@Repository
public class ParametroRepositorio {

    private final JdbcTemplate jdbc;

    public ParametroRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<Parametro> FILA = (rs, n) -> new Parametro(
            rs.getString("clave"),
            rs.getString("valor"),
            rs.getString("descripcion"));

    public record Parametro(String clave, String valor, String descripcion) {
    }

    public List<Parametro> todos() {
        return jdbc.query(
                "SELECT clave, valor, descripcion FROM sirve.parametro ORDER BY clave", FILA);
    }

    public Optional<String> leer(String clave) {
        return jdbc.queryForList(
                "SELECT valor FROM sirve.parametro WHERE clave = ?", String.class, clave)
                .stream().findFirst();
    }

    public void guardar(String clave, String valor) {
        jdbc.update("""
                INSERT INTO sirve.parametro (clave, valor, actualizado_en)
                VALUES (?, ?, now())
                ON CONFLICT (clave) DO UPDATE
                   SET valor = EXCLUDED.valor, actualizado_en = now()
                """, clave, valor);
    }
}
