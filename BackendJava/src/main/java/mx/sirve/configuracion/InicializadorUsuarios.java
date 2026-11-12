package mx.sirve.configuracion;

import mx.sirve.repositorio.UsuarioRepositorio;
import mx.sirve.servicio.AutenticacionServicio;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.ApplicationArguments;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.security.SecureRandom;

/**
 * Crea el primer administrador si no hay ningún usuario.
 *
 * Sin esto, la aplicación quedaría cerrada y sin puerta: el login exige un
 * usuario que todavía no existe. Se corre una sola vez, en el primer arranque
 * con la tabla vacía.
 *
 * La contraseña sale de la variable ADMIN_CLAVE si está definida; si no, se
 * genera una y se escribe en el registro. Es la única vez que aparece en claro:
 * a partir de ahí solo existe su hash.
 */
@Configuration
public class InicializadorUsuarios {

    private static final Logger log = LoggerFactory.getLogger(InicializadorUsuarios.class);
    private static final String ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    @Bean
    public ApplicationRunner crearPrimerAdmin(UsuarioRepositorio usuarios,
                                              AutenticacionServicio autenticacion,
                                              @Value("${app.admin.clave:}") String claveDeEntorno) {
        return (ApplicationArguments args) -> {
            if (usuarios.hayUsuarios()) return;

            String clave = (claveDeEntorno == null || claveDeEntorno.isBlank())
                    ? generar()
                    : claveDeEntorno;

            usuarios.crear("admin", "Administrador",
                    autenticacion.hashear(clave), "ADMIN", true);

            log.warn("""
                    ============================================================
                     Se creó el usuario «admin» porque no había ninguno.
                     Contraseña: {}

                     Cámbiala al entrar. Esta línea no volverá a aparecer y la
                     contraseña no se puede recuperar, solo restablecer.
                    ============================================================""", clave);
        };
    }

    private String generar() {
        SecureRandom azar = new SecureRandom();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 12; i++) sb.append(ALFABETO.charAt(azar.nextInt(ALFABETO.length())));
        return sb.toString();
    }
}
