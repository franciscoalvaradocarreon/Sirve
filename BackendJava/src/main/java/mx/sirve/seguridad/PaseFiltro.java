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
    private static final String[] PROTEGIDAS = {"/api/capturas", "/api/mis-casillas", "/api/sesion", "/api/actas"};

    /** Clave con la que el controlador recibe quién está capturando. */
    public static final String ATRIBUTO_CAPTURISTA = "idCapturista";
    public static final String ATRIBUTO_DISPOSITIVO = "idDispositivo";

    private final DispositivoServicio dispositivos;

    public PaseFiltro(DispositivoServicio dispositivos) {
        this.dispositivos = dispositivos;
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
