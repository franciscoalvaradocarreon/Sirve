package mx.sirve.seguridad;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import mx.sirve.servicio.DispositivoServicio;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;

/**
 * Exige el pase del dispositivo en las rutas de captura.
 *
 * Es un filtro de servlet y no Spring Security: se necesita una sola cosa
 * —comprobar un pase— y montar el marco completo habría traído configuración
 * de sesiones, formularios y CSRF que aquí no aplican.
 *
 * Las rutas administrativas (capturistas, dispositivos) quedan fuera de este
 * filtro por ahora: se protegen con acceso al servidor. Está anotado como
 * pendiente en la guía de seguridad.
 */
@Component
public class PaseFiltro extends OncePerRequestFilter {

    /** Rutas que exigen pase. */
    /**
     * Rutas que el teléfono necesita para capturar.
     *
     * Los catálogos entran aquí desde que el escritorio tiene login: el
     * teléfono arma su combo de elección y sus opciones de boleta con ellos, y
     * no puede tener una sesión de escritorio. Se acepta el pase o una sesión
     * válida, lo que venga.
     */
    private static final String[] PROTEGIDAS = {
            "/api/capturas", "/api/mis-casillas", "/api/sesion", "/api/actas",
            "/api/procesos", "/api/elecciones"
    };

    /** Clave con la que el controlador recibe quién está capturando. */
    public static final String ATRIBUTO_CAPTURISTA = "idCapturista";
    public static final String ATRIBUTO_DISPOSITIVO = "idDispositivo";

    private final DispositivoServicio dispositivos;
    private final JwtServicio jwt;
    private final mx.sirve.repositorio.UsuarioRepositorio usuarios;

    public PaseFiltro(DispositivoServicio dispositivos, JwtServicio jwt,
                      mx.sirve.repositorio.UsuarioRepositorio usuarios) {
        this.dispositivos = dispositivos;
        this.jwt = jwt;
        this.usuarios = usuarios;
    }

    /**
     * ¿Quien pide es un usuario del escritorio con permiso de capturar?
     *
     * Si lo es, deja la sesión en la petición para que el controlador sepa a
     * quién atribuir la captura. La comprobación de rol se repite aquí a
     * propósito: este filtro corre antes que el de sesión en estas rutas.
     */
    private boolean esSesionDeCaptura(HttpServletRequest peticion) {
        String cabecera = peticion.getHeader("Authorization");
        if (cabecera == null || !cabecera.regionMatches(true, 0, "Bearer ", 0, 7)) return false;

        JwtServicio.DatosToken datos = jwt.leer(cabecera.substring(7).trim());
        if (datos == null) return false;

        // Los catálogos son de solo lectura: cualquier rol con sesión puede
        // consultarlos. Las rutas de captura, en cambio, solo los que capturan.
        String ruta = peticion.getRequestURI();
        boolean soloLectura = ruta.startsWith("/api/procesos") || ruta.startsWith("/api/elecciones");

        boolean alcanza = soloLectura || switch (datos.rol()) {
            case "ADMIN", "COORDINADOR", "OPERADOR" -> true;
            default -> false;
        };
        if (!alcanza) return false;

        // El token debe seguir vigente: si el usuario cerró sesión o cambió su
        // contraseña, el contador ya no coincide.
        var version = usuarios.versionToken(datos.idUsuario());
        if (version.isEmpty() || version.get() != datos.version()) return false;

        peticion.setAttribute(JwtServicio.ATRIBUTO_USUARIO, datos);
        return true;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest peticion,
                                    HttpServletResponse respuesta,
                                    FilterChain cadena) throws ServletException, IOException {

        if (!requierePase(peticion.getRequestURI())) {
            cadena.doFilter(peticion, respuesta);
            return;
        }

        String pase = leerPase(peticion);
        Optional<int[]> quien = dispositivos.autenticar(pase);

        if (quien.isEmpty()) {
            /*
             * Sin pase, pero puede ser el escritorio.
             *
             * La captura también se hace desde computadora, con la sesión del
             * usuario y su rol. Si viene un token válido de un rol que captura,
             * se deja pasar: no hay capturista ni dispositivo, y el controlador
             * registra al usuario en `capturada_por` con origen PORTAL.
             *
             * Se acepta solo cuando NO hay pase: un teléfono con pase inválido
             * sigue rechazado, para que un aparato dado de baja no se cuele con
             * la sesión de otra persona.
             */
            // Se prueba igual aunque venga algo en la cabecera: el método
            // valida el token y su rol, así que un pase inválido no pasa.
            if (esSesionDeCaptura(peticion)) {
                cadena.doFilter(peticion, respuesta);
                return;
            }

            respuesta.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            respuesta.setContentType("application/json;charset=UTF-8");
            // Una sola línea: un salto dentro de la cadena no es JSON válido.
            respuesta.getWriter().write(
                    "{\"error\":{\"codigo\":\"NO_AUTENTICADO\",\"mensaje\":"
                    + "\"Este teléfono no está enrolado. Escanea el código que te dieron.\"}}");
            return;
        }

        peticion.setAttribute(ATRIBUTO_DISPOSITIVO, quien.get()[0]);
        peticion.setAttribute(ATRIBUTO_CAPTURISTA, quien.get()[1]);
        cadena.doFilter(peticion, respuesta);
    }

    private boolean requierePase(String ruta) {
        /*
         * Las imágenes de acta se sirven sin pase.
         *
         * Es una excepción consciente: el reporte de actas se consulta desde
         * el escritorio, que hoy no tiene autenticación propia. Cuando exista,
         * esta es la primera ruta que hay que cerrar junto con él.
         */
        if (ruta.startsWith("/api/actas/") && ruta.endsWith("/imagen")) {
            return false;
        }
        for (String protegida : PROTEGIDAS) {
            if (ruta.startsWith(protegida)) return true;
        }
        return false;
    }

    /** El pase viaja en «Authorization: Bearer …». */
    private String leerPase(HttpServletRequest peticion) {
        String cabecera = peticion.getHeader("Authorization");
        if (cabecera == null) return null;
        String limpia = cabecera.trim();
        return limpia.regionMatches(true, 0, "Bearer ", 0, 7) ? limpia.substring(7).trim() : limpia;
    }
}
