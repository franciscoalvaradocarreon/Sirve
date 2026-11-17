package mx.sirve.controlador;

import mx.sirve.modelo.dto.CapturistaDTO;
import mx.sirve.seguridad.PaseFiltro;
import mx.sirve.servicio.CapturistaServicio;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Quién está detrás de este pase.
 *
 * El teléfono lo consulta al arrancar: si el pase ya no sirve —porque el
 * aparato se dio de baja—, la respuesta es 401 y la aplicación vuelve a pedir
 * el código, en lugar de quedarse con datos viejos.
 */
@RestController
@RequestMapping("/api/sesion")
public class SesionControlador {

    private final CapturistaServicio capturistas;

    public SesionControlador(CapturistaServicio capturistas) {
        this.capturistas = capturistas;
    }

    @GetMapping
    public ResponseEntity<CapturistaDTO> sesion(
            @RequestAttribute(name = PaseFiltro.ATRIBUTO_CAPTURISTA, required = false)
            Integer idCapturista) {

        if (idCapturista == null) {
            throw new mx.sirve.excepcion.DatosInvalidosExcepcion("SESION_TELEFONO",
                    "Esta ruta es del teléfono; el escritorio usa su propia sesión.");
        }
        return ResponseEntity.ok(capturistas.obtener(idCapturista));
    }
}