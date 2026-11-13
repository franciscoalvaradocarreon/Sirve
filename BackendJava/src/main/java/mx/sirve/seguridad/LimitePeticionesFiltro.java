package mx.sirve.seguridad;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Límite de peticiones por IP.
 *
 * Sin esto, una sola máquina puede pedir miles de veces por minuto y el
 * servidor no tiene forma de distinguirla de un capturista. No detiene un
 * ataque distribuido —para eso hace falta filtrar en la red, no aquí— pero sí
 * el abuso desde una conexión.
 *
 * Dos cubetas, porque no todos los endpoints valen lo mismo:
 *
 * · La general, amplia. Varios capturistas pueden salir a internet por la
 *   misma IP de la operadora, así que un límite bajo rompería el trabajo
 *   legítimo. Se prefiere dejar pasar de más antes que dejar fuera a alguien
 *   en campo.
 *
 * · La de entrada, estrecha. El login prueba contraseñas: ahí sí conviene ser
 *   estricto, y no afecta a quien ya está dentro.
 *
 * No se usa un límite por usuario porque antes de entrar no se sabe quién es,
 * y porque el ataque que importa —el que no tiene credencial— se hace sin
 * sesión.
 */
@Component
public class LimitePeticionesFiltro extends OncePerRequestFilter {

    /** Peticiones por minuto y por IP en todo el API. */
    private final int limiteGeneral;

    /** Peticiones por minuto y por IP en las rutas que prueban credenciales. */
    private final int limiteCredenciales;

    private final Map<String, Cubeta> cubetas = new ConcurrentHashMap<>();

    public LimitePeticionesFiltro(
            @Value("${app.limite.general:300}") int limiteGeneral,
            @Value("${app.limite.credenciales:20}") int limiteCredenciales) {
        this.limiteGeneral = limiteGeneral;
        this.limiteCredenciales = limiteCredenciales;
    }

    /** Rutas donde se adivinan credenciales: se limitan más. */
    private static boolean esDeCredenciales(String ruta) {
        return ruta.equals("/api/auth/login") || ruta.equals("/api/dispositivos/enrolar");
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest peticion) {
        // Solo el API. Los archivos del SPA no son el objetivo de un abuso, y
        // limitarlos rompería la primera carga de la aplicación.
        return !peticion.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest peticion, HttpServletResponse respuesta,
                                    FilterChain cadena) throws ServletException, IOException {

        String ruta = peticion.getRequestURI();
        String ip = ipDelCliente(peticion);
        int limite = esDeCredenciales(ruta) ? limiteCredenciales : limiteGeneral;
        String llave = (esDeCredenciales(ruta) ? "c:" : "g:") + ip;

        Cubeta cubeta = cubetas.computeIfAbsent(llave, k -> new Cubeta());
        if (!cubeta.permitir(limite)) {
            respuesta.setStatus(429);
            respuesta.setHeader("Retry-After", "60");
            respuesta.setContentType("application/json;charset=UTF-8");
            respuesta.getWriter().write(
                    "{\"error\":{\"codigo\":\"DEMASIADAS_PETICIONES\",\"mensaje\":"
                    + "\"Demasiadas peticiones desde esta conexión. Espera un minuto.\"}}");
            return;
        }

        cadena.doFilter(peticion, respuesta);
    }

    /**
     * IP del cliente.
     *
     * Se toma la primera de X-Forwarded-For porque la petición llega a través
     * del Caddy del servidor: sin esto, todas las peticiones parecerían venir
     * de 127.0.0.1 y una sola IP bloquearía a todos.
     *
     * Esa cabecera la puede falsificar el cliente, así que un atacante puede
     * repartir sus peticiones entre IPs inventadas. El límite frena el abuso
     * torpe, no a quien sabe lo que hace; para eso está el filtrado en la red.
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
     * Ventana fija de un minuto.
     *
     * Se reinicia sola al cambiar de minuto, sin necesidad de limpiar el mapa
     * a mano. Las entradas viejas se descartan cuando el mapa crece demasiado:
     * sin eso, un ataque con muchas IPs lo haría crecer sin fin.
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
            if (cubetas.size() > 20_000) cubetas.clear();
            return cuenta.incrementAndGet() <= limite;
        }
    }
}
