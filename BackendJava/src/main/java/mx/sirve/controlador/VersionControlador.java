package mx.sirve.controlador;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Qué versión está corriendo.
 *
 * La etiqueta la pone el compose al construir la imagen, así que responde con
 * la verdad del contenedor y no con un número escrito a mano en el código.
 * Es pública a propósito: sirve para comprobar desde fuera qué se publicó, y
 * no expone nada del sistema.
 */
@RestController
@RequestMapping("/api/version")
public class VersionControlador {

    private final String version;

    public VersionControlador(@Value("${VERSION_APP:local}") String version) {
        this.version = version;
    }

    @GetMapping
    public ResponseEntity<Map<String, String>> version() {
        return ResponseEntity.ok(Map.of("version", version));
    }
}