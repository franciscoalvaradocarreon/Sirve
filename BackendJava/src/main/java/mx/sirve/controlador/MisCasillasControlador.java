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

    /**
     * Las casillas del teléfono.
     *
     * El capturista sale del pase, no del cuerpo. Si la petición llega con
     * sesión de escritorio —que el filtro también acepta— no hay capturista, y
     * eso antes reventaba con un error interno: aquí se explica qué hacer.
     */
    @GetMapping
    public ResponseEntity<List<CasillaAsignadaDTO>> listar(
            @RequestAttribute(name = PaseFiltro.ATRIBUTO_CAPTURISTA, required = false)
            Integer idCapturista,
            @RequestParam(name = "id_eleccion") int idEleccion) {

        if (idCapturista == null) {
            throw new mx.sirve.excepcion.DatosInvalidosExcepcion("SESION_TELEFONO",
                    "Esta pantalla es del teléfono. Para capturar desde el escritorio usa «Capturar casilla».");
        }
        return ResponseEntity.ok(capturistas.misCasillas(idCapturista, idEleccion));
    }
}
