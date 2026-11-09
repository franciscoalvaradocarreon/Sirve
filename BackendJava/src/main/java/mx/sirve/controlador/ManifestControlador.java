package mx.sirve.controlador;

import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Manifiesto de la aplicación instalable.
 *
 * Se sirve desde un controlador y no como archivo estático porque Tomcat lo
 * entrega como `application/octet-stream`: el archivo llega igual, pero el
 * navegador espera `application/manifest+json` para reconocerlo como
 * manifiesto. Con el tipo correcto la instalación no depende de que el
 * navegador sea indulgente.
 */
@RestController
public class ManifestControlador {

    private static final MediaType TIPO_MANIFIESTO =
            MediaType.parseMediaType("application/manifest+json");

    @GetMapping(value = "/manifest.webmanifest", produces = "application/manifest+json")
    public ResponseEntity<Resource> manifiesto() {
        Resource archivo = new ClassPathResource("static/manifest.webmanifest");
        if (!archivo.exists()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok().contentType(TIPO_MANIFIESTO).body(archivo);
    }
}
