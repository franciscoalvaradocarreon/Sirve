package mx.sirve.servicio;

import mx.sirve.excepcion.DatosInvalidosExcepcion;
import mx.sirve.modelo.dto.RespuestaLogin;
import mx.sirve.modelo.dto.UsuarioDTO;
import mx.sirve.repositorio.MenuRepositorio;
import mx.sirve.repositorio.UsuarioRepositorio;
import mx.sirve.seguridad.JwtServicio;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;

/**
 * Entrada al escritorio.
 *
 * Tres detalles que importan:
 *
 * · El mensaje de error es el mismo si el usuario no existe o si la
 *   contraseña falla. Distinguirlos permitiría averiguar qué usuarios hay.
 * · Cinco intentos fallidos bloquean la cuenta quince minutos. Sin eso, una
 *   contraseña corta se adivina probando.
 * · Una cuenta recién bloqueada responde lo mismo que una contraseña mal
 *   puesta hasta que pasa el plazo, para no confirmar que existe.
 */
@Service
public class AutenticacionServicio {

    private final UsuarioRepositorio usuarios;
    private final MenuRepositorio menus;
    private final JwtServicio jwt;
    private final BCryptPasswordEncoder codificador = new BCryptPasswordEncoder(12);

    public AutenticacionServicio(UsuarioRepositorio usuarios, MenuRepositorio menus, JwtServicio jwt) {
        this.usuarios = usuarios;
        this.menus = menus;
        this.jwt = jwt;
    }

    @Transactional
    public RespuestaLogin entrar(String usuario, String clave) {
        if (usuario == null || usuario.isBlank() || clave == null || clave.isEmpty()) {
            throw new DatosInvalidosExcepcion("CREDENCIALES", "Escribe tu usuario y tu contraseña.");
        }

        Optional<Map<String, Object>> fila = usuarios.credenciales(usuario.trim());

        if (fila.isEmpty()) {
            throw new DatosInvalidosExcepcion("CREDENCIALES",
                    "El usuario o la contraseña no son correctos.");
        }

        Map<String, Object> u = fila.get();
        String id = (String) u.get("id");

        OffsetDateTime bloqueadoHasta = u.get("bloqueado_hasta") == null
                ? null
                : ((java.sql.Timestamp) u.get("bloqueado_hasta")).toInstant()
                        .atOffset(java.time.ZoneOffset.UTC);
        if (bloqueadoHasta != null && bloqueadoHasta.isAfter(OffsetDateTime.now(java.time.ZoneOffset.UTC))) {
            throw new DatosInvalidosExcepcion("CUENTA_BLOQUEADA",
                    "Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.");
        }

        if (!codificador.matches(clave, (String) u.get("hash"))) {
            usuarios.registrarFallo(id);
            throw new DatosInvalidosExcepcion("CREDENCIALES",
                    "El usuario o la contraseña no son correctos.");
        }

        if (!Boolean.TRUE.equals(u.get("activo"))) {
            throw new DatosInvalidosExcepcion("USUARIO_INACTIVO",
                    "Este usuario está desactivado. Pide que lo reactiven.");
        }

        String rol = (String) u.get("rol");
        int version = u.get("token_version") == null ? 0 : ((Number) u.get("token_version")).intValue();

        usuarios.marcarAcceso(id);

        UsuarioDTO dto = usuarios.porId(id).orElseThrow();
        String token = jwt.emitir(id, (String) u.get("usuario"), (String) u.get("nombre"), rol, version);

        return new RespuestaLogin(token, dto, menus.delRol(rol));
    }

    @Transactional
    public void salir(String idUsuario) {
        usuarios.cerrarSesiones(idUsuario);
    }

    public String hashear(String clave) {
        return codificador.encode(clave);
    }
}
