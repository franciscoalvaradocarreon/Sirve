package mx.sirve.seguridad;

import java.util.List;
import java.util.Optional;

/**
 * Qué menú protege cada ruta del API.
 *
 * Es la pieza que une las dos mitades: la pantalla de menús por rol y el filtro
 * que decide el acceso. Si una ruta aparece aquí, el permiso sale del menú; si
 * no, se aplican las reglas de siempre.
 *
 * El orden importa: se busca la coincidencia más específica primero, así
 * /api/reportes/asignacion gana sobre /api/reportes.
 */
public final class RutasConMenu {

    /**
     * @param prefijo  parte inicial de la ruta
     * @param menu     clave del menú en la tabla
     */
    public record Ruta(String prefijo, String menu) {
    }

    private static final List<Ruta> RUTAS = List.of(
            new Ruta("/api/usuarios/menus", "usuarios"),
            new Ruta("/api/usuarios", "usuarios"),
            new Ruta("/api/parametros", "parametros"),
            new Ruta("/api/capturistas", "capturistas"),
            // Los teléfonos se administran desde la pantalla de capturistas.
            new Ruta("/api/dispositivos", "capturistas"),

            new Ruta("/api/reportes/operacion", "operacion-tablero"),
            new Ruta("/api/reportes/asignacion", "asignacion"),
            new Ruta("/api/reportes/actas", "actas"),
            new Ruta("/api/avance", "avance"),

            new Ruta("/api/catalogos/partidos", "partidos"),
            new Ruta("/api/catalogos/coaliciones", "coaliciones"),
            new Ruta("/api/catalogos/boletas", "boletas"),
            new Ruta("/api/procesos", "procesos"),
            new Ruta("/api/elecciones", "elecciones"),
            new Ruta("/api/municipios", "municipios"),
            new Ruta("/api/distritos", "distritos"),
            new Ruta("/api/secciones", "secciones"),
            new Ruta("/api/casillas", "casillas")
    );

    private RutasConMenu() {
    }

    /** El menú que protege esa ruta, si alguno. */
    public static Optional<String> menuDe(String ruta) {
        for (Ruta r : RUTAS) {
            if (ruta.equals(r.prefijo()) || ruta.startsWith(r.prefijo() + "/")) {
                return Optional.of(r.menu());
            }
        }
        return Optional.empty();
    }
}
