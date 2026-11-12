package mx.sirve.modelo.dto;

import java.util.List;

/**
 * Una entrada del menú.
 *
 * Los hijos vienen anidados: el servidor manda el árbol ya armado y el
 * navegador solo lo dibuja. Un grupo —Catálogos, Reportes— llega sin ruta y
 * con hijos.
 */
public record MenuDTO(
        Integer id,
        String clave,
        String etiqueta,
        String ruta,
        String icono,
        List<MenuDTO> hijos) {
}