package mx.sirve.controlador;

import mx.sirve.seguridad.PaseFiltro;
import mx.sirve.servicio.ActaFotoServicio;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.CacheControl;
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

        /*
         * La imagen de una casilla cambia poco: se sube una vez y se reemplaza
         * solo si hay que corregirla. Sin caché, cada desplazamiento por la
         * banda de miniaturas volvía a descargar las mismas imágenes, y al
         * avanzar rápido el navegador terminaba cancelando descargas y dejando
         * huecos rotos.
         *
         * Diez minutos de caché en el navegador y una validación por ETag:
         * suficiente para que recorrer la galería no cueste una descarga por
         * miniatura, y corto como para que un reemplazo se vea pronto.
         */
        long bytes = 0;
        try {
            bytes = java.nio.file.Files.size(ruta);
        } catch (java.io.IOException e) {
            // Si no se puede medir, el ETag queda en cero: se pierde la
            // validación, no la imagen.
        }
        String etag = "\"" + bytes + "-" + ruta.getFileName() + "\"";

        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .cacheControl(CacheControl.maxAge(java.time.Duration.ofMinutes(10)).cachePublic())
                .eTag(etag)
                .body(new FileSystemResource(ruta));
    }
}
