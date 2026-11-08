package mx.sirve.controlador;

import mx.sirve.modelo.dto.EleccionDTO;
import mx.sirve.modelo.dto.ProcesoDTO;
import mx.sirve.servicio.EleccionServicio;
import mx.sirve.servicio.ProcesoServicio;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Procesos electorales y las elecciones que cuelgan de cada uno. */
@RestController
@RequestMapping("/api/procesos")
public class ProcesoControlador {

    private final ProcesoServicio procesoServicio;
    private final EleccionServicio eleccionServicio;

    public ProcesoControlador(ProcesoServicio procesoServicio,
                              EleccionServicio eleccionServicio) {
        this.procesoServicio = procesoServicio;
        this.eleccionServicio = eleccionServicio;
    }

    @GetMapping
    public ResponseEntity<List<ProcesoDTO>> listar() {
        return ResponseEntity.ok(procesoServicio.listar());
    }

    @GetMapping("/{id}/elecciones")
    public ResponseEntity<List<EleccionDTO>> elecciones(@PathVariable int id) {
        procesoServicio.exigirQueExista(id);
        return ResponseEntity.ok(eleccionServicio.listarPorProceso(id));
    }
}