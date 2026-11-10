package mx.sirve.controlador;

import jakarta.validation.Valid;
import mx.sirve.modelo.dto.CapturaCrearDTO;
import mx.sirve.modelo.dto.CapturaDTO;
import mx.sirve.modelo.dto.VotoDTO;
import mx.sirve.seguridad.PaseFiltro;
import mx.sirve.servicio.CapturaServicio;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Captura y consulta de resultados por casilla.
 *
 * El POST es alta o reemplazo: recapturar una casilla la pisa, nunca devuelve
 * «ya existe». La app reintenta con el mismo id_cliente si se corta la red.
 */
@RestController
@RequestMapping("/api/capturas")
public class CapturaControlador {

    private final CapturaServicio capturaServicio;

    public CapturaControlador(CapturaServicio capturaServicio) {
        this.capturaServicio = capturaServicio;
    }

    @GetMapping("/{idCasilla}/{idEleccion}")
    public ResponseEntity<CapturaDTO> consultar(@PathVariable int idCasilla,
                                                @PathVariable int idEleccion) {
        return ResponseEntity.ok(capturaServicio.consultar(idCasilla, idEleccion));
    }

    @GetMapping("/{idCasilla}/{idEleccion}/votos")
    public ResponseEntity<List<VotoDTO>> votos(@PathVariable int idCasilla,
                                               @PathVariable int idEleccion) {
        CapturaDTO captura = capturaServicio.consultar(idCasilla, idEleccion);
        return ResponseEntity.ok(capturaServicio.votos(captura.id()));
    }

    /**
     * El capturista y el teléfono llegan del filtro del pase, no del cuerpo:
     * si vinieran del cuerpo, cualquiera podría decir que es otro.
     */
    @PostMapping
    public ResponseEntity<CapturaDTO> guardar(
            @Valid @RequestBody CapturaCrearDTO datos,
            @RequestAttribute(PaseFiltro.ATRIBUTO_CAPTURISTA) int idCapturista,
            @RequestAttribute(PaseFiltro.ATRIBUTO_DISPOSITIVO) int idDispositivo) {
        CapturaDTO guardada = capturaServicio.guardar(datos, idCapturista, idDispositivo);
        return ResponseEntity.status(HttpStatus.CREATED).body(guardada);
    }
}
