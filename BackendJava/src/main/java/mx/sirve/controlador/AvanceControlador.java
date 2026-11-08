package mx.sirve.controlador;

import mx.sirve.modelo.dto.AvanceResumenDTO;
import mx.sirve.servicio.AvanceServicio;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Reporte de avance de la captura. */
@RestController
@RequestMapping("/api/avance")
public class AvanceControlador {

    private final AvanceServicio avanceServicio;

    public AvanceControlador(AvanceServicio avanceServicio) {
        this.avanceServicio = avanceServicio;
    }

    /**
     * Avance de una elección, agrupado por municipio o por distrito.
     *
     * @param agrupacion municipio (por omisión), distrito_local o distrito_federal
     */
    @GetMapping
    public ResponseEntity<AvanceResumenDTO> resumir(
            @RequestParam(name = "id_eleccion") int idEleccion,
            @RequestParam(name = "agrupacion", required = false) String agrupacion) {
        return ResponseEntity.ok(avanceServicio.resumir(idEleccion, agrupacion));
    }
}
