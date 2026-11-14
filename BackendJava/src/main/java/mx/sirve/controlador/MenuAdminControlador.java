package mx.sirve.controlador;

import mx.sirve.excepcion.DatosInvalidosExcepcion;
import mx.sirve.repositorio.MenuRepositorio;
import mx.sirve.seguridad.JwtServicio;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Qué menús ve cada rol.
 *
 * Vive bajo /api/usuarios a propósito: así lo alcanza la misma regla que ya
 * limita la administración de usuarios al rol ADMIN, sin agregar otra.
 *
 * Cambiar esto afecta a todos los usuarios de ese rol la próxima vez que
 * recarguen: el menú se pide al servidor en cada arranque.
 */
@RestController
@RequestMapping("/api/usuarios/menus")
public class MenuAdminControlador {

    private final MenuRepositorio menus;

    public MenuAdminControlador(MenuRepositorio menus) {
        this.menus = menus;
    }

    /** Catálogo completo, los roles y lo que tiene concedido cada uno. */
    @GetMapping
    public ResponseEntity<Map<String, Object>> estado(
            @RequestAttribute(JwtServicio.ATRIBUTO_USUARIO) JwtServicio.DatosToken datos) {
        exigirAdmin(datos);
        return ResponseEntity.ok(Map.of(
                "menus", menus.catalogo(),
                "roles", menus.roles(),
                "permisos", menus.porRol()));
    }

    @PutMapping("/{rol}")
    @Transactional
    public ResponseEntity<Void> guardar(
            @PathVariable String rol,
            @RequestBody Map<String, List<Integer>> cuerpo,
            @RequestAttribute(JwtServicio.ATRIBUTO_USUARIO) JwtServicio.DatosToken datos) {
        exigirAdmin(datos);

        // Dejar al Administrador sin ningún menú dejaría el sistema sin forma de
        // volver a configurarlos desde la aplicación.
        if ("ADMIN".equals(rol)) {
            List<Integer> ids = cuerpo.get("menus");
            if (ids == null || ids.isEmpty()) {
                throw new DatosInvalidosExcepcion("PROPIO_ROL",
                        "El rol Administrador debe conservar al menos el menú de usuarios.");
            }
        }

        menus.guardarRol(rol, cuerpo.getOrDefault("menus", List.of()));
        return ResponseEntity.noContent().build();
    }

    private void exigirAdmin(JwtServicio.DatosToken datos) {
        if (!"ADMIN".equals(datos.rol())) {
            throw new mx.sirve.excepcion.SinPermisoExcepcion("SIN_PERMISO",
                    "Solo un administrador puede configurar los menús.");
        }
    }
}
