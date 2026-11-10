package mx.sirve.controlador;

import mx.sirve.modelo.dto.EnrolamientoDTO;
import mx.sirve.modelo.dto.EnrolarDTO;
import mx.sirve.servicio.DispositivoServicio;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Enrolamiento del teléfono.
 *
 * Es la única ruta abierta sin pase —todavía no hay pase que presentar—, así
 * que el único dato que la protege es el código, que es de un solo uso y solo
 * lo tiene quien recibió la hoja impresa.
 */
@RestController
@RequestMapping("/api/dispositivos")
public class DispositivoControlador {

    private final DispositivoServicio dispositivos;

    public DispositivoControlador(DispositivoServicio dispositivos) {
        this.dispositivos = dispositivos;
    }

    /**
     * Canjea el código por un pase.
     *
     * La elección es opcional: si viene, la respuesta trae además las casillas
     * asignadas con su estado, para que el teléfono quede listo de una vez.
     */
    @PostMapping("/enrolar")
    public ResponseEntity<EnrolamientoDTO> enrolar(
            @RequestBody EnrolarDTO datos,
            @RequestParam(name = "id_eleccion", required = false) Integer idEleccion) {
        return ResponseEntity.ok(dispositivos.enrolar(datos.codigo(), idEleccion));
    }
}
