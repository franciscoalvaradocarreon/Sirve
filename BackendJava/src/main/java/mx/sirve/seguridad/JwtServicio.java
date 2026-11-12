package mx.sirve.seguridad;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;

/**
 * Emite y valida los tokens del escritorio.
 *
 * El token lleva quién es el usuario, su rol y un contador de sesiones. Ese
 * contador es lo que permite cerrar sesión de verdad: si el token trae una
 * versión distinta de la que hay en la base, ya no vale. Sin él, copiar un
 * token daría acceso hasta que expirara, aunque el usuario hubiera salido.
 *
 * El móvil no usa esto: sigue con el código de enrolamiento.
 */
@Component
public class JwtServicio {

    public static final String ATRIBUTO_USUARIO = "usuarioAutenticado";

    private final SecretKey clave;
    private final Duration vigencia;

    public JwtServicio(
            @Value("${app.jwt.clave}") String clave,
            @Value("${app.jwt.horas:12}") long horas) {
        if (clave == null || clave.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException(
                    "app.jwt.clave debe tener al menos 32 caracteres (variable JWT_CLAVE)");
        }
        this.clave = Keys.hmacShaKeyFor(clave.getBytes(StandardCharsets.UTF_8));
        this.vigencia = Duration.ofHours(horas);
    }

    public String emitir(String idUsuario, String usuario, String nombre, String rol, int version) {
        Instant ahora = Instant.now();
        return Jwts.builder()
                .subject(usuario)
                .claim("uid", idUsuario)
                .claim("nombre", nombre)
                .claim("rol", rol)
                .claim("tv", version)
                .issuedAt(Date.from(ahora))
                .expiration(Date.from(ahora.plus(vigencia)))
                .signWith(clave)
                .compact();
    }

    /** Devuelve los datos del token, o null si no es válido o ya venció. */
    public DatosToken leer(String token) {
        try {
            Claims c = Jwts.parser().verifyWith(clave).build()
                    .parseSignedClaims(token).getPayload();
            return new DatosToken(
                    String.valueOf(c.get("uid")),
                    c.getSubject(),
                    (String) c.get("nombre"),
                    (String) c.get("rol"),
                    c.get("tv") == null ? 0 : ((Number) c.get("tv")).intValue());
        } catch (Exception e) {
            return null;
        }
    }

    public record DatosToken(String idUsuario, String usuario, String nombre, String rol, int version) {
    }
}
