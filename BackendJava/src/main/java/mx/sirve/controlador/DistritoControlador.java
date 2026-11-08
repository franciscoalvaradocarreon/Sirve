package mx.sirve.controlador;

import mx.sirve.modelo.dto.DistritoDTO;
import mx.sirve.servicio.DistritoServicio;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Distritos locales y federales. */
@RestController
@RequestMapping("/api/distritos")
public class DistritoControlador {

    private final DistritoServicio distritoServicio;

    public DistritoControlador(DistritoServicio distritoServicio) {
        this.distritoServicio = distritoServicio;
    }

    @GetMapping
    public ResponseEntity<List<DistritoDTO>> listar(@RequestParam(name = "tipo") String tipo,
                                                    @RequestParam(name = "id_proceso") int idProceso) {
        return ResponseEntity.ok(distritoServicio.listar(tipo, idProceso));
    }
}