package mx.sirve.controlador;

import mx.sirve.modelo.dto.CasillaAsignadaDTO;
import mx.sirve.seguridad.PaseFiltro;
import mx.sirve.servicio.CapturistaServicio;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Las casillas del teléfono que está capturando.
 *
 * No recibe identificador de capturista: sale del pase. Así nadie puede pedir
 * las casillas de otra persona cambiando un número en la dirección.
 */
@RestController
@RequestMapping("/api/mis-casillas")
public class MisCasillasControlador {

    private final CapturistaServicio capturistas;

    public MisCasillasControlador(CapturistaServicio capturistas) {
        this.capturistas = capturistas;
    }

    @GetMapping
    public ResponseEntity<List<CasillaAsignadaDTO>> listar(
            @RequestAttribute(PaseFiltro.ATRIBUTO_CAPTURISTA) int idCapturista,
            @RequestParam(name = "id_eleccion") int idEleccion) {
        return ResponseEntity.ok(capturistas.misCasillas(idCapturista, idEleccion));
    }
}
