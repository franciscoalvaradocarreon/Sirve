package mx.sirve.controlador;

import mx.sirve.seguridad.PaseFiltro;
import mx.sirve.servicio.ActaFotoServicio;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.util.Map;

/**
 * Foto del acta.
 *
 * La subida va aparte del guardado de la captura a propósito: la foto es
 * opcional, y una imagen que no sube —por falta de señal o de espacio— no debe
 * impedir que se guarde el número.
 */
@RestController
@RequestMapping("/api/actas")
public class ActaFotoControlador {

    private final ActaFotoServicio servicio;

    public ActaFotoControlador(ActaFotoServicio servicio) {
        this.servicio = servicio;
    }

    @PostMapping(path = "/{idCasilla}/{idEleccion}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> subir(
            @PathVariable int idCasilla,
            @PathVariable int idEleccion,
            @RequestParam("archivo") MultipartFile archivo,
            @RequestAttribute(PaseFiltro.ATRIBUTO_CAPTURISTA) int idCapturista,
            @RequestAttribute(PaseFiltro.ATRIBUTO_DISPOSITIVO) int idDispositivo) {
        return ResponseEntity.ok(
                servicio.guardar(idCasilla, idEleccion, archivo, idCapturista, idDispositivo));
    }

    /** Si esa casilla ya tiene foto, sin descargarla. */
    @GetMapping("/{idCasilla}/{idEleccion}")
    public ResponseEntity<Map<String, Object>> estado(
            @PathVariable int idCasilla,
            @PathVariable int idEleccion) {
        return ResponseEntity.ok(Map.of("tiene", servicio.tiene(idCasilla, idEleccion)));
    }

    /** La imagen, para verla desde el escritorio. */
    @GetMapping("/{idCasilla}/{idEleccion}/imagen")
    public ResponseEntity<Resource> imagen(
            @PathVariable int idCasilla,
            @PathVariable int idEleccion) {
        Path ruta = servicio.archivo(idCasilla, idEleccion);
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .body(new FileSystemResource(ruta));
    }
}
