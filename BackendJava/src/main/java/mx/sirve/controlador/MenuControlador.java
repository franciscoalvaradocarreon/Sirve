package mx.sirve.controlador;

import mx.sirve.modelo.dto.MenuDTO;
import mx.sirve.repositorio.MenuRepositorio;
import mx.sirve.seguridad.JwtServicio;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * El menú del usuario que está dentro.
 *
 * Lo decide el servidor a partir de su rol: lo que no está concedido no
 * viaja, así que no hay forma de que el navegador muestre una pantalla que
 * el API después rechace.
 */
@RestController
@RequestMapping("/api/menu")
public class MenuControlador {

    private final MenuRepositorio menus;

    public MenuControlador(MenuRepositorio menus) {
        this.menus = menus;
    }

    @GetMapping
    public ResponseEntity<List<MenuDTO>> menu(
            @RequestAttribute(JwtServicio.ATRIBUTO_USUARIO) JwtServicio.DatosToken datos) {
        return ResponseEntity.ok(menus.delRol(datos.rol()));
    }
}