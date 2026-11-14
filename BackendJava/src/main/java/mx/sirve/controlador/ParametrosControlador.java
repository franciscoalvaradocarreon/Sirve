package mx.sirve.controlador;

import mx.sirve.excepcion.SinPermisoExcepcion;
import mx.sirve.repositorio.ParametroRepositorio;
import mx.sirve.seguridad.JwtServicio;
import mx.sirve.servicio.ParametrosServicio;
import org.springframework.http.ResponseEntity;
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
 * Parámetros de la aplicación.
 *
 * Solo el Administrador: aquí se decide qué ve todo el mundo. Encender la sala
 * de resultados desde una cuenta de consulta no tendría sentido.
 */
@RestController
@RequestMapping("/api/parametros")
public class ParametrosControlador {

    private final ParametrosServicio servicio;

    public ParametrosControlador(ParametrosServicio servicio) {
        this.servicio = servicio;
    }

    @GetMapping
    public ResponseEntity<List<ParametroRepositorio.Parametro>> listar(
            @RequestAttribute(JwtServicio.ATRIBUTO_USUARIO) JwtServicio.DatosToken datos) {
        exigirAdmin(datos);
        return ResponseEntity.ok(servicio.todos());
    }

    @PutMapping("/{clave}")
    public ResponseEntity<Void> guardar(
            @PathVariable String clave,
            @RequestBody Map<String, String> cuerpo,
            @RequestAttribute(JwtServicio.ATRIBUTO_USUARIO) JwtServicio.DatosToken datos) {
        exigirAdmin(datos);
        servicio.guardar(clave, cuerpo.getOrDefault("valor", ""));
        return ResponseEntity.noContent().build();
    }

    private void exigirAdmin(JwtServicio.DatosToken datos) {
        if (!"ADMIN".equals(datos.rol())) {
            throw new SinPermisoExcepcion("SIN_PERMISO",
                    "Solo un administrador puede cambiar los parámetros.");
        }
    }
}