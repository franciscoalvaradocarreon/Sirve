package mx.sirve.controlador;

import mx.sirve.modelo.dto.UsuarioDTO;
import mx.sirve.seguridad.JwtServicio;
import mx.sirve.servicio.UsuarioServicio;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Administración de usuarios.
 *
 * Solo el rol ADMIN llega aquí: el filtro comprueba la sesión, y este
 * controlador comprueba el rol. Las dos cosas, porque una sesión válida de un
 * capturista no debe poder crear usuarios.
 */
@RestController
@RequestMapping("/api/usuarios")
public class UsuarioControlador {

    private final UsuarioServicio servicio;

    public UsuarioControlador(UsuarioServicio servicio) {
        this.servicio = servicio;
    }

    @GetMapping
    public ResponseEntity<List<UsuarioDTO>> listar(
            @RequestAttribute(JwtServicio.ATRIBUTO_USUARIO) JwtServicio.DatosToken datos) {
        exigirAdmin(datos);
        return ResponseEntity.ok(servicio.listar());
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> crear(
            @RequestBody Map<String, Object> cuerpo,
            @RequestAttribute(JwtServicio.ATRIBUTO_USUARIO) JwtServicio.DatosToken datos) {
        exigirAdmin(datos);
        String clave = servicio.crear(
                (String) cuerpo.get("usuario"),
                (String) cuerpo.get("nombre"),
                (String) cuerpo.get("rol"),
                (String) cuerpo.get("clave"));
        // La contraseña viaja una sola vez: no se puede volver a consultar.
        return ResponseEntity.ok(Map.of("clave", clave));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Void> actualizar(
            @PathVariable String id,
            @RequestBody Map<String, Object> cuerpo,
            @RequestAttribute(JwtServicio.ATRIBUTO_USUARIO) JwtServicio.DatosToken datos) {
        exigirAdmin(datos);
        servicio.actualizar(id,
                (String) cuerpo.getOrDefault("nombre", ""),
                (String) cuerpo.get("rol"),
                Boolean.TRUE.equals(cuerpo.get("activo")),
                datos.idUsuario());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/clave")
    public ResponseEntity<Map<String, String>> restablecer(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, Object> cuerpo,
            @RequestAttribute(JwtServicio.ATRIBUTO_USUARIO) JwtServicio.DatosToken datos) {
        exigirAdmin(datos);
        String clave = servicio.restablecer(id, cuerpo == null ? null : (String) cuerpo.get("clave"));
        return ResponseEntity.ok(Map.of("clave", clave));
    }

    /** Cambio de la propia contraseña. Cualquier rol puede hacerlo. */
    @PostMapping("/mia")
    public ResponseEntity<Void> cambiarPropia(
            @RequestBody Map<String, Object> cuerpo,
            @RequestAttribute(JwtServicio.ATRIBUTO_USUARIO) JwtServicio.DatosToken datos) {
        servicio.cambiarPropia(datos.idUsuario(),
                (String) cuerpo.get("actual"), (String) cuerpo.get("nueva"));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(
            @PathVariable String id,
            @RequestAttribute(JwtServicio.ATRIBUTO_USUARIO) JwtServicio.DatosToken datos) {
        exigirAdmin(datos);
        servicio.eliminar(id, datos.idUsuario());
        return ResponseEntity.noContent().build();
    }

    private void exigirAdmin(JwtServicio.DatosToken datos) {
        if (!"ADMIN".equals(datos.rol())) {
            throw new mx.sirve.excepcion.DatosInvalidosExcepcion("SIN_PERMISO",
                    "Solo un administrador puede administrar usuarios.");
        }
    }
}
