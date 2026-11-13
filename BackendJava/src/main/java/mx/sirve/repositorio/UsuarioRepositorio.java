package mx.sirve.repositorio;

import mx.sirve.modelo.dto.UsuarioDTO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Usuarios del escritorio.
 *
 * La tabla ya existía con su enum de roles y su hash. Aquí solo se lee y se
 * escribe; la contraseña nunca sale convertida en DTO, y la consulta que la
 * trae es distinta de la que arma la lista.
 *
 * Las columnas `intentos_fallidos` y `bloqueado_hasta` se aprovechan: cinco
 * intentos fallidos dejan la cuenta bloqueada un cuarto de hora. Sin eso, una
 * contraseña corta se puede adivinar a fuerza de probar.
 */
@Repository
public class UsuarioRepositorio {

    private final JdbcTemplate jdbc;

    public UsuarioRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<UsuarioDTO> FILA = (rs, n) -> new UsuarioDTO(
            rs.getString("id"),
            rs.getString("usuario"),
            rs.getString("nombre"),
            rs.getString("rol"),
            etiquetaRol(rs.getString("rol")),
            rs.getBoolean("activo"),
            rs.getObject("ultimo_acceso", java.time.OffsetDateTime.class));

    private static final String SELECT = """
            SELECT id, usuario, nombre, rol::text AS rol, activo, ultimo_acceso
              FROM sirve.usuario
            """;

    public List<UsuarioDTO> listar() {
        return jdbc.query(SELECT + " ORDER BY nombre", FILA);
    }

    public Optional<UsuarioDTO> porId(String id) {
        return jdbc.query(SELECT + " WHERE id = ?::uuid", FILA, id).stream().findFirst();
    }

    public Optional<UsuarioDTO> porUsuario(String usuario) {
        return jdbc.query(SELECT + " WHERE lower(usuario) = lower(?)", FILA, usuario)
                .stream().findFirst();
    }

    /** Hash, estado y bloqueo, solo para comprobar la contraseña al entrar. */
    public Optional<Map<String, Object>> credenciales(String usuario) {
        return jdbc.queryForList("""
                SELECT id::text AS id, usuario, nombre, hash_password AS hash, activo,
                       rol::text AS rol, token_version,
                       intentos_fallidos, bloqueado_hasta
                  FROM sirve.usuario
                 WHERE lower(usuario) = lower(?)
                """, usuario).stream().findFirst();
    }

    public Optional<Integer> versionToken(String idUsuario) {
        return jdbc.queryForList(
                "SELECT token_version FROM sirve.usuario WHERE id = ?::uuid AND activo",
                Integer.class, idUsuario).stream().findFirst();
    }

    public boolean hayUsuarios() {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM sirve.usuario", Integer.class);
        return n != null && n > 0;
    }

    public void crear(String usuario, String nombre, String hash, String rol, boolean activo) {
        jdbc.update("""
                INSERT INTO sirve.usuario (usuario, nombre, hash_password, rol, activo)
                VALUES (?, ?, ?, ?::sirve.rol_usuario, ?)
                """, usuario, nombre, hash, rol, activo);
    }

    public void actualizar(String id, String usuario, String nombre, String rol, boolean activo) {
        jdbc.update("""
                UPDATE sirve.usuario
                   SET usuario = ?, nombre = ?, rol = ?::sirve.rol_usuario, activo = ?
                 WHERE id = ?::uuid
                """, usuario, nombre, rol, activo, id);
    }

    /** ¿Ese nombre de usuario ya lo tiene otra persona? */
    public boolean usuarioOcupado(String usuario, String exceptoId) {
        Integer n = jdbc.queryForObject("""
                SELECT count(*) FROM sirve.usuario
                 WHERE lower(usuario) = lower(?) AND id <> ?::uuid
                """, Integer.class, usuario, exceptoId);
        return n != null && n > 0;
    }

    /** Cambia la contraseña y cierra las sesiones abiertas de ese usuario. */
    public void cambiarClave(String id, String hash) {
        jdbc.update("""
                UPDATE sirve.usuario
                   SET hash_password = ?, token_version = token_version + 1,
                       intentos_fallidos = 0, bloqueado_hasta = NULL
                 WHERE id = ?::uuid
                """, hash, id);
    }

    /** Cierra la sesión: invalida cualquier token ya emitido. */
    public void cerrarSesiones(String id) {
        jdbc.update("UPDATE sirve.usuario SET token_version = token_version + 1 WHERE id = ?::uuid", id);
    }

    public void marcarAcceso(String id) {
        jdbc.update("""
                UPDATE sirve.usuario
                   SET ultimo_acceso = now(), intentos_fallidos = 0, bloqueado_hasta = NULL
                 WHERE id = ?::uuid
                """, id);
    }

    /** Suma un intento fallido y bloquea la cuenta al llegar a cinco. */
    public void registrarFallo(String id) {
        jdbc.update("""
                UPDATE sirve.usuario
                   SET intentos_fallidos = intentos_fallidos + 1,
                       bloqueado_hasta = CASE WHEN intentos_fallidos + 1 >= 5
                                              THEN now() + interval '15 minutes'
                                              ELSE bloqueado_hasta END
                 WHERE id = ?::uuid
                """, id);
    }

    public void eliminar(String id) {
        jdbc.update("DELETE FROM sirve.usuario WHERE id = ?::uuid", id);
    }

    /** Nombre legible del rol, para no mostrar el enum en pantalla. */
    public static String etiquetaRol(String rol) {
        return switch (rol == null ? "" : rol) {
            case "ADMIN" -> "Administrador";
            case "COORDINADOR" -> "Supervisor";
            case "OPERADOR" -> "Capturista";
            case "ANALISTA" -> "Analista";
            case "AUDITOR" -> "Auditor";
            default -> rol;
        };
    }
}
