package mx.sirve.controlador;

import mx.sirve.modelo.dto.OpcionBoletaDTO;
import mx.sirve.servicio.EleccionServicio;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** La boleta de una elección. */
@RestController
@RequestMapping("/api/elecciones")
public class EleccionControlador {

    private final EleccionServicio eleccionServicio;

    public EleccionControlador(EleccionServicio eleccionServicio) {
        this.eleccionServicio = eleccionServicio;
    }

    @GetMapping("/{id}/opciones")
    public ResponseEntity<List<OpcionBoletaDTO>> opciones(@PathVariable int id) {
        return ResponseEntity.ok(eleccionServicio.listarOpciones(id));
    }
}