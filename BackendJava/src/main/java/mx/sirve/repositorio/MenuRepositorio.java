package mx.sirve.repositorio;

import mx.sirve.modelo.dto.MenuDTO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Menús que ve cada rol.
 *
 * El árbol se arma aquí y no en el navegador: así el servidor decide qué
 * existe, y el front solo dibuja lo que recibe. Si un menú no está concedido,
 * simplemente no viaja.
 */
@Repository
public class MenuRepositorio {

    private final JdbcTemplate jdbc;

    public MenuRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Menús concedidos a un rol, como árbol. */
    public List<MenuDTO> delRol(String rol) {
        List<Map<String, Object>> filas = jdbc.queryForList("""
                SELECT m.id, m.clave, m.etiqueta, m.ruta, m.icono, m.id_padre, m.orden
                  FROM sirve.menu m
                  JOIN sirve.rol_menu rm ON rm.id_menu = m.id
                 WHERE rm.rol = ?::sirve.rol_usuario AND m.activo
                 ORDER BY m.orden
                """, rol);

        Map<Integer, MenuDTO> porId = new LinkedHashMap<>();
        for (Map<String, Object> f : filas) {
            porId.put(((Number) f.get("id")).intValue(), new MenuDTO(
                    ((Number) f.get("id")).intValue(),
                    (String) f.get("clave"),
                    (String) f.get("etiqueta"),
                    (String) f.get("ruta"),
                    (String) f.get("icono"),
                    new ArrayList<>()));
        }

        List<MenuDTO> raices = new ArrayList<>();
        for (Map<String, Object> f : filas) {
            int id = ((Number) f.get("id")).intValue();
            Object padre = f.get("id_padre");
            MenuDTO menu = porId.get(id);
            if (padre == null) {
                raices.add(menu);
            } else {
                MenuDTO contenedor = porId.get(((Number) padre).intValue());
                // Si el padre no está concedido, el hijo sube a la raíz en vez
                // de desaparecer: es preferible un enlace suelto a un menú
                // invisible por una concesión incompleta.
                if (contenedor != null) contenedor.hijos().add(menu);
                else raices.add(menu);
            }
        }
        return raices;
    }

    public List<Map<String, Object>> todos() {
        return jdbc.queryForList("""
                SELECT m.id, m.clave, m.etiqueta, m.ruta, m.id_padre, m.activo
                  FROM sirve.menu m ORDER BY m.orden
                """);
    }
}
