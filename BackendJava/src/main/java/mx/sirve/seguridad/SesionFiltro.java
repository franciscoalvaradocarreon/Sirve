package mx.sirve.seguridad;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import mx.sirve.repositorio.UsuarioRepositorio;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

/**
 * Exige un token válido en todo el API administrativo.
 *
 * Es el mismo patrón que {@link PaseFiltro}: un filtro de servlet que
 * comprueba una credencial y deja los datos en la petición. Se hizo así y no
 * con Spring Security para no cambiar el comportamiento del SPA ni de las
 * rutas del teléfono, que tienen su propia credencial.
 *
 * Lo que queda abierto:
 *  · el inicio de sesión, que es donde se pide el token;
 *  · las rutas del móvil —capturas, mis-casillas, sesión y actas—, que
 *    defiende {@link PaseFiltro};
 *  · la imagen del acta, porque un <img> del navegador no manda cabeceras;
 *  · el armazón del SPA —index.html y sus archivos—, que no lleva datos.
 */
@Component
public class SesionFiltro extends OncePerRequestFilter {

    /** Rutas que no exigen token de escritorio. */
    private static final List<String> ABIERTAS = List.of(
            "/api/auth/login",
            // La versión se consulta desde fuera para saber qué se publicó.
            "/api/version",
            // El teléfono se enrola con un código de un solo uso, no con una
            // sesión: es justo el paso en el que todavía no tiene credencial.
            "/api/dispositivos/enrolar",
            "/api/capturas",
            "/api/mis-casillas",
            "/api/sesion",
            "/api/actas",
            // Catálogos que el teléfono consulta para armar su captura: los
            // vigila el filtro del pase, que acepta pase o sesión.
            "/api/procesos",
            "/api/elecciones"
    );

    /**
     * Qué rol alcanza cada parte del API.
     *
     * El menú ya esconde lo que no toca, pero eso no protege: un GET a mano
     * seguiría funcionando. Estas reglas son la protección de verdad, y por eso
     * están en el filtro y no en cada controlador.
     *
     * Se evalúa la ruta más específica primero: /api/reportes/asignacion antes
     * que /api/reportes.
     */
    private record Regla(String prefijo, java.util.Set<String> roles) {
    }

    private static final java.util.List<Regla> REGLAS = java.util.List.of(
            new Regla("/api/usuarios", java.util.Set.of("ADMIN")),
            new Regla("/api/capturistas", java.util.Set.of("ADMIN", "COORDINADOR")),
            new Regla("/api/dispositivos", java.util.Set.of("ADMIN", "COORDINADOR")),
            new Regla("/api/reportes", java.util.Set.of("ADMIN", "COORDINADOR", "ANALISTA", "AUDITOR")),
            new Regla("/api/catalogos", java.util.Set.of("ADMIN", "COORDINADOR")),
            new Regla("/api/procesos", java.util.Set.of("ADMIN", "COORDINADOR")),
            new Regla("/api/elecciones", java.util.Set.of("ADMIN", "COORDINADOR")),
            new Regla("/api/municipios", java.util.Set.of("ADMIN", "COORDINADOR")),
            new Regla("/api/distritos", java.util.Set.of("ADMIN", "COORDINADOR")),
            new Regla("/api/secciones", java.util.Set.of("ADMIN", "COORDINADOR")),
            new Regla("/api/casillas", java.util.Set.of("ADMIN", "COORDINADOR"))
    );

    private final JwtServicio jwt;
    private final UsuarioRepositorio usuarios;

    public SesionFiltro(JwtServicio jwt, UsuarioRepositorio usuarios) {
        this.jwt = jwt;
        this.usuarios = usuarios;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest peticion) {
        String ruta = peticion.getRequestURI();

        // Solo se vigila el API. El SPA se sirve libre: sus archivos no llevan
        // datos y la pantalla de login vive ahí.
        if (!ruta.startsWith("/api/")) return true;

        for (String abierta : ABIERTAS) {
            if (ruta.equals(abierta) || ruta.startsWith(abierta + "/")) return true;
        }
        return false;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest peticion, HttpServletResponse respuesta,
                                    FilterChain cadena) throws ServletException, IOException {

        String cabecera = peticion.getHeader("Authorization");
        if (cabecera == null || !cabecera.regionMatches(true, 0, "Bearer ", 0, 7)) {
            rechazar(respuesta, "Se requiere iniciar sesión.");
            return;
        }

        JwtServicio.DatosToken datos = jwt.leer(cabecera.substring(7).trim());
        if (datos == null) {
            rechazar(respuesta, "La sesión expiró. Vuelve a entrar.");
            return;
        }

        // El contador de sesiones invalida los tokens anteriores al cerrar
        // sesión o al cambiar la contraseña.
        Optional<Integer> versionActual = usuarios.versionToken(datos.idUsuario());
        if (versionActual.isEmpty() || versionActual.get() != datos.version()) {
            rechazar(respuesta, "Esta sesión ya no es válida. Vuelve a entrar.");
            return;
        }

        String ruta = peticion.getRequestURI();
        for (Regla regla : REGLAS) {
            if (ruta.equals(regla.prefijo()) || ruta.startsWith(regla.prefijo() + "/")) {
                if (!regla.roles().contains(datos.rol())) {
                    rechazarPermiso(respuesta);
                    return;
                }
                break;
            }
        }

        peticion.setAttribute(JwtServicio.ATRIBUTO_USUARIO, datos);
        cadena.doFilter(peticion, respuesta);
    }

    /** El usuario está dentro pero su rol no alcanza: 403. */
    private void rechazarPermiso(HttpServletResponse respuesta) throws IOException {
        respuesta.setStatus(HttpServletResponse.SC_FORBIDDEN);
        respuesta.setContentType("application/json;charset=UTF-8");
        respuesta.getWriter().write(
                "{\"error\":{\"codigo\":\"SIN_PERMISO\",\"mensaje\":\"Tu rol no tiene acceso a esta sección.\"}}");
    }

    /** Respuesta 401 en una sola línea, como el resto del API. */
    private void rechazar(HttpServletResponse respuesta, String mensaje) throws IOException {
        respuesta.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        respuesta.setContentType("application/json;charset=UTF-8");
        respuesta.getWriter().write(
                "{\"error\":{\"codigo\":\"NO_AUTENTICADO\",\"mensaje\":\"" + mensaje + "\"}}");
    }
}
