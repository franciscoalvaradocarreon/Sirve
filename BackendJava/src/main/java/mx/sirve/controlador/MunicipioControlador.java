package mx.sirve.controlador;

import mx.sirve.modelo.dto.MunicipioDTO;
import mx.sirve.servicio.MunicipioServicio;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Municipios con secciones en un proceso. */
@RestController
@RequestMapping("/api/municipios")
public class MunicipioControlador {

    private final MunicipioServicio municipioServicio;

    public MunicipioControlador(MunicipioServicio municipioServicio) {
        this.municipioServicio = municipioServicio;
    }

    @GetMapping
    public ResponseEntity<List<MunicipioDTO>> listar(@RequestParam(name = "id_proceso") int idProceso) {
        return ResponseEntity.ok(municipioServicio.listar(idProceso));
    }
}