package mx.sirve.controlador;

import mx.sirve.modelo.dto.AsignacionDTO;
import mx.sirve.servicio.AsignacionServicio;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Reporte de secciones asignadas a los capturistas. */
@RestController
@RequestMapping("/api/reportes/asignacion")
public class AsignacionControlador {

    private final AsignacionServicio servicio;

    public AsignacionControlador(AsignacionServicio servicio) {
        this.servicio = servicio;
    }

    @GetMapping
    public ResponseEntity<List<AsignacionDTO>> listar(
            @RequestParam(name = "id_eleccion") int idEleccion) {
        return ResponseEntity.ok(servicio.listar(idEleccion));
    }
}