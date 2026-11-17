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

    /* ------------------------------------------------------------------
     * Administración de menús por rol
     * ------------------------------------------------------------------ */

    /**
     * Todos los menús, agrupados por su padre.
     *
     * El orden no puede ser solo por número: los hijos de un grupo comparten
     * rango con los de otro, y ordenar plano intercala «Partidos» entre
     * «Capturistas» y «Usuarios» aunque pertenezca a Catálogos. Se ordena
     * primero por el orden del padre y después por el del hijo, así cada grupo
     * queda seguido de sus entradas.
     */
    public List<Map<String, Object>> catalogo() {
        return jdbc.queryForList("""
                SELECT m.id, m.clave, m.etiqueta, m.ruta, m.icono, m.id_padre, m.orden
                  FROM sirve.menu m
                  LEFT JOIN sirve.menu padre ON padre.id = m.id_padre
                 WHERE m.activo
                 ORDER BY coalesce(padre.orden, m.orden),
                          (m.id_padre IS NOT NULL),
                          m.orden,
                          m.id
                """);
    }

    /** Qué menús tiene concedidos cada rol. */
    public Map<String, java.util.Set<Integer>> porRol() {
        Map<String, java.util.Set<Integer>> mapa = new java.util.LinkedHashMap<>();
        jdbc.query("SELECT rol::text AS rol, id_menu FROM sirve.rol_menu", rs -> {
            mapa.computeIfAbsent(rs.getString("rol"), k -> new java.util.LinkedHashSet<>())
                    .add(rs.getInt("id_menu"));
        });
        return mapa;
    }

    /**
     * Reemplaza los menús de un rol.
     *
     * Se borra y se vuelve a escribir en la misma transacción: es más simple
     * que calcular altas y bajas, y con veinte menús el costo es nulo.
     */
    public void guardarRol(String rol, List<Integer> ids) {
        jdbc.update("DELETE FROM sirve.rol_menu WHERE rol = ?::sirve.rol_usuario", rol);
        for (Integer id : ids) {
            jdbc.update("""
                    INSERT INTO sirve.rol_menu (rol, id_menu)
                    VALUES (?::sirve.rol_usuario, ?) ON CONFLICT DO NOTHING
                    """, rol, id);
        }
    }

    /** Los roles que existen en el enum, con su nombre legible. */
    public List<Map<String, Object>> roles() {
        return jdbc.queryForList("""
                SELECT e.enumlabel AS clave,
                       CASE e.enumlabel
                         WHEN 'ADMIN' THEN 'Administrador'
                         WHEN 'COORDINADOR' THEN 'Supervisor'
                         WHEN 'OPERADOR' THEN 'Capturista'
                         WHEN 'ANALISTA' THEN 'Analista'
                         WHEN 'AUDITOR' THEN 'Auditor'
                         WHEN 'REPRESENTANTE' THEN 'Representante'
                         ELSE e.enumlabel
                       END AS nombre
                  FROM pg_enum e
                  JOIN pg_type t ON t.oid = e.enumtypid
                  JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'sirve' AND t.typname = 'rol_usuario'
                 ORDER BY e.enumsortorder
                """);
    }
}
