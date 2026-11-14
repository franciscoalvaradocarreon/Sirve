package mx.sirve.controlador;

import mx.sirve.modelo.dto.CapturistaCrearDTO;
import mx.sirve.modelo.dto.CapturistaDTO;
import mx.sirve.modelo.dto.CodigoEnrolamientoDTO;
import mx.sirve.modelo.dto.DispositivoDTO;
import mx.sirve.modelo.dto.ImportacionDTO;
import mx.sirve.servicio.CapturistaServicio;
import mx.sirve.servicio.ImportacionServicio;
import mx.sirve.servicio.DispositivoServicio;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Administración de capturistas y de sus teléfonos.
 *
 * Estas rutas NO piden pase: se usan desde el escritorio, al dar de alta a la
 * gente. Hoy quedan protegidas por el acceso al servidor; cuando exista
 * autenticación de administración, es lo primero que hay que cerrar.
 */
@RestController
@RequestMapping("/api/capturistas")
public class CapturistaControlador {

    private final CapturistaServicio capturistas;
    private final DispositivoServicio dispositivos;
    private final ImportacionServicio importacion;

    public CapturistaControlador(CapturistaServicio capturistas,
                                 DispositivoServicio dispositivos,
                                 ImportacionServicio importacion) {
        this.capturistas = capturistas;
        this.dispositivos = dispositivos;
        this.importacion = importacion;
    }

    /**
     * Alta masiva desde un archivo.
     *
     * El archivo se lee en el navegador y se manda ya convertido a filas: así
     * el servidor no tiene que interpretar comas dentro de comillas ni
     * codificaciones, que es donde suelen romperse estas cosas.
     */
    @PostMapping("/importar")
    public ResponseEntity<ImportacionDTO.Resultado> importar(@RequestBody ImportacionDTO datos) {
        return ResponseEntity.ok(importacion.importar(datos.filas()));
    }

    @GetMapping
    public ResponseEntity<List<CapturistaDTO>> listar() {
        return ResponseEntity.ok(capturistas.listar());
    }

    @GetMapping("/{id}")
    public ResponseEntity<CapturistaDTO> obtener(@PathVariable int id) {
        return ResponseEntity.ok(capturistas.obtener(id));
    }

    @PostMapping
    public ResponseEntity<CapturistaDTO> crear(@RequestBody CapturistaCrearDTO datos) {
        return ResponseEntity.status(HttpStatus.CREATED).body(capturistas.crear(datos));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CapturistaDTO> actualizar(@PathVariable int id,
                                                    @RequestBody CapturistaCrearDTO datos) {
        return ResponseEntity.ok(capturistas.actualizar(id, datos));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable int id) {
        capturistas.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    /** Reemplaza la asignación completa de secciones. */
    @PutMapping("/{id}/secciones")
    public ResponseEntity<CapturistaDTO> asignar(@PathVariable int id,
                                                 @RequestBody Map<String, List<Integer>> cuerpo) {
        return ResponseEntity.ok(
                capturistas.asignarSecciones(id, cuerpo.getOrDefault("secciones", List.of())));
    }

    @GetMapping("/{id}/telefonos")
    public ResponseEntity<List<DispositivoDTO>> telefonos(@PathVariable int id) {
        return ResponseEntity.ok(dispositivos.listar(id));
    }

    /** Genera un código de enrolamiento para un teléfono nuevo. */
    @PostMapping("/{id}/telefonos")
    public ResponseEntity<CodigoEnrolamientoDTO> nuevoTelefono(
            @PathVariable int id,
            @RequestParam(name = "nombre", required = false) String nombre) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(dispositivos.generarCodigo(id, nombre));
    }

    /** Reemite el código de un teléfono: sirve para cambiarlo de aparato. */
    @PostMapping("/telefonos/{idDispositivo}/codigo")
    public ResponseEntity<CodigoEnrolamientoDTO> reemitir(@PathVariable int idDispositivo) {
        return ResponseEntity.ok(dispositivos.reemitir(idDispositivo));
    }

    @DeleteMapping("/telefonos/{idDispositivo}")
    public ResponseEntity<Void> desactivarTelefono(@PathVariable int idDispositivo) {
        dispositivos.desactivar(idDispositivo);
        return ResponseEntity.noContent().build();
    }
}
