package mx.sirve.seguridad;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Límite de peticiones.
 *
 * La clave no es siempre la IP, y esa es la decisión importante aquí: las
 * operadoras móviles usan CGNAT, así que cientos de teléfonos pueden salir a
 * internet con la misma dirección. Limitar por IP el tráfico ya autenticado
 * dejaría fuera a capturistas legítimos justo en el momento de la jornada.
 *
 * Por eso:
 *
 * · Petición con credencial  → se cuenta por CREDENCIAL. Cada teléfono o
 *   sesión tiene la suya, sin importar la IP de la que venga. Un capturista
 *   hace diez o quince peticiones por minuto como mucho; el límite es amplio.
 *
 * · Petición sin credencial  → se cuenta por IP. Es el tráfico anónimo, donde
 *   no hay otra identidad; aquí vive el abuso y aquí conviene ser estricto.
 *
 * · Login y enrolamiento     → por IP y más estricto todavía: son los únicos
 *   sitios donde se pueden adivinar credenciales.
 */
@Component
public class LimitePeticionesFiltro extends OncePerRequestFilter {

    /** Peticiones por minuto para una misma sesión o teléfono. */
    private final int porCredencial;

    /** Peticiones por minuto desde una IP sin credencial. */
    private final int porIpAnonima;

    /** Peticiones por minuto e IP en las rutas que prueban credenciales. */
    private final int porIpCredenciales;

    private final Map<String, Cubeta> cubetas = new ConcurrentHashMap<>();

    public LimitePeticionesFiltro(
            @Value("${app.limite.credencial:600}") int porCredencial,
            @Value("${app.limite.anonima:300}") int porIpAnonima,
            @Value("${app.limite.credenciales:20}") int porIpCredenciales) {
        this.porCredencial = porCredencial;
        this.porIpAnonima = porIpAnonima;
        this.porIpCredenciales = porIpCredenciales;
    }

    private static boolean esDeCredenciales(String ruta) {
        return ruta.equals("/api/auth/login") || ruta.equals("/api/dispositivos/enrolar");
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest peticion) {
        // Solo el API. Los archivos del SPA no son objetivo de un abuso, y
        // limitarlos rompería la primera carga de la aplicación.
        return !peticion.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest peticion, HttpServletResponse respuesta,
                                    FilterChain cadena) throws ServletException, IOException {

        String ruta = peticion.getRequestURI();
        String credencial = credencialDe(peticion);

        String llave;
        int limite;

        if (esDeCredenciales(ruta)) {
            llave = "i:" + ipDelCliente(peticion);
            limite = porIpCredenciales;
        } else if (credencial != null) {
            llave = "c:" + credencial;
            limite = porCredencial;
        } else {
            llave = "i:" + ipDelCliente(peticion);
            limite = porIpAnonima;
        }

        Cubeta cubeta = cubetas.computeIfAbsent(llave, k -> new Cubeta());
        if (!cubeta.permitir(limite)) {
            respuesta.setStatus(429);
            respuesta.setHeader("Retry-After", "60");
            respuesta.setContentType("application/json;charset=UTF-8");
            respuesta.getWriter().write(
                    "{\"error\":{\"codigo\":\"DEMASIADAS_PETICIONES\",\"mensaje\":"
                    + "\"Demasiadas peticiones. Espera un minuto.\"}}");
            return;
        }

        cadena.doFilter(peticion, respuesta);
    }

    /**
     * Identifica la credencial sin validarla.
     *
     * Basta con una huella del token: dos peticiones del mismo teléfono dan la
     * misma huella y no hace falta consultar la base para contar. No se guarda
     * el token, solo su SHA-256 truncado.
     */
    private String credencialDe(HttpServletRequest peticion) {
        String cabecera = peticion.getHeader("Authorization");
        if (cabecera == null || !cabecera.regionMatches(true, 0, "Bearer ", 0, 7)) return null;

        String token = cabecera.substring(7).trim();
        if (token.isEmpty()) return null;

        try {
            byte[] huella = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(huella).substring(0, 24);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * IP del cliente.
     *
     * Se toma la primera de X-Forwarded-For porque la petición llega a través
     * del Caddy del servidor: sin esto todas parecerían venir de 127.0.0.1.
     * Esa cabecera se puede falsificar, así que sólo sirve para el tráfico
     * anónimo: un atacante puede repartir sus peticiones entre IPs inventadas.
     */
    private String ipDelCliente(HttpServletRequest peticion) {
        String reenviada = peticion.getHeader("X-Forwarded-For");
        if (reenviada != null && !reenviada.isBlank()) {
            int coma = reenviada.indexOf(',');
            return (coma > 0 ? reenviada.substring(0, coma) : reenviada).trim();
        }
        return peticion.getRemoteAddr();
    }

    /**
     * Ventana fija de un minuto, que se reinicia sola.
     *
     * Las entradas viejas se descartan cuando el mapa crece demasiado: sin eso,
     * un ataque con muchas IPs o credenciales lo haría crecer sin fin.
     */
    private final class Cubeta {
        private long minuto = System.currentTimeMillis() / 60_000;
        private final AtomicInteger cuenta = new AtomicInteger();

        boolean permitir(int limite) {
            long ahora = System.currentTimeMillis() / 60_000;
            if (ahora != minuto) {
                minuto = ahora;
                cuenta.set(0);
            }
            if (cubetas.size() > 50_000) cubetas.clear();
            return cuenta.incrementAndGet() <= limite;
        }
    }
}
