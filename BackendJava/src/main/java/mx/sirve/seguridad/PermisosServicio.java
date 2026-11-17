package mx.sirve.seguridad;

import mx.sirve.repositorio.MenuRepositorio;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Qué menús tiene cada rol, para decidir el acceso al API.
 *
 * Antes el permiso estaba en dos lugares que no se hablaban: la tabla de menús
 * por rol —lo que se ve en la pantalla— y unas listas de roles escritas en el
 * filtro. Conceder un menú no daba acceso, y quitarlo no lo cerraba. Ahora manda
 * el menú: si el rol lo tiene, la ruta funciona; si no, responde 403.
 *
 * Se guarda en memoria porque se consulta en cada petición y cambia pocas veces.
 * Al guardar la matriz de menús se limpia, y la siguiente petición vuelve a leer.
 */
@Service
public class PermisosServicio {

    private final MenuRepositorio menus;

    /** Menús por rol, ya leídos. */
    private final Map<String, Set<String>> cache = new ConcurrentHashMap<>();

    public PermisosServicio(MenuRepositorio menus) {
        this.menus = menus;
    }

    /** Si el rol tiene concedido ese menú. */
    public boolean tieneMenu(String rol, String claveMenu) {
        if (rol == null || claveMenu == null) return false;

        Set<String> claves = cache.computeIfAbsent(rol, this::leer);
        return claves.contains(claveMenu);
    }

    private Set<String> leer(String rol) {
        try {
            return Set.copyOf(menus.clavesPorRol(rol));
        } catch (Exception e) {
            // Si la consulta falla, se niega: un fallo de lectura no debe abrir
            // una sección. Y no se guarda en caché, para reintentar.
            cache.remove(rol);
            return Set.of();
        }
    }

    /** Se llama al guardar la matriz de menús, para que el cambio aplique ya. */
    public void olvidar() {
        cache.clear();
    }
}
