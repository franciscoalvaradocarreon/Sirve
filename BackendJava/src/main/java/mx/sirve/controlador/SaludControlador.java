package mx.sirve.controlador;

import mx.sirve.servicio.DiscoServicio;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Estado del servidor que conviene tener a la vista.
 *
 * Vive bajo /api/salud, con sesión pero sin rol especial: cualquiera que
 * coordine la captura necesita saber si el disco se está llenando.
 */
@RestController
@RequestMapping("/api/salud")
public class SaludControlador {

    private final DiscoServicio disco;

    public SaludControlador(DiscoServicio disco) {
        this.disco = disco;
    }

    @GetMapping("/disco")
    public ResponseEntity<Map<String, Object>> disco() {
        return ResponseEntity.ok(disco.estado());
    }
}