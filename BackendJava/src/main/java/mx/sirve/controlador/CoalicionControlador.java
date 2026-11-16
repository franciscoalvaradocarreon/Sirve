package mx.sirve.controlador;

import mx.sirve.excepcion.DatosInvalidosExcepcion;
import mx.sirve.excepcion.NoEncontradoExcepcion;
import mx.sirve.repositorio.CoalicionRepositorio;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Catálogo de coaliciones.
 *
 * Bajo /api/catalogos, con la misma regla de roles que los demás catálogos.
 *
 * No hay alta ni baja: una coalición se arma con partidos y pertenece al
 * proceso, y crearla o deshacerla son operaciones de captura, no de catálogo.
 * Aquí se ajusta lo visible —nombre, color, logo— y se activa o desactiva.
 */
@RestController
@RequestMapping("/api/catalogos/coaliciones")
public class CoalicionControlador {

    private static final Pattern COLOR = Pattern.compile("^#[0-9A-Fa-f]{6}$");
    private static final long LOGO_MAXIMO = 512 * 1024;

    private static final org.slf4j.Logger log =
            org.slf4j.LoggerFactory.getLogger(CoalicionControlador.class);

    /** Nombre, color y estado; las coaliciones no se crean desde aquí. */
    public record Entrada(String nombre, String color, Boolean activa) {
    }

    private final CoalicionRepositorio coaliciones;

    public CoalicionControlador(CoalicionRepositorio coaliciones) {
        this.coaliciones = coaliciones;
    }

    @GetMapping
    public ResponseEntity<List<CoalicionRepositorio.Coalicion>> listar() {
        return ResponseEntity.ok(coaliciones.listar());
    }

    @PutMapping("/{id}")
    public ResponseEntity<CoalicionRepositorio.Coalicion> actualizar(
            @PathVariable int id, @RequestBody Entrada datos) {

        CoalicionRepositorio.Coalicion actual = coaliciones.buscar(id)
                .orElseThrow(() -> new NoEncontradoExcepcion("NO_ENCONTRADO",
                        "No existe la coalición " + id));

        String nombre = datos.nombre() == null ? actual.nombre() : datos.nombre().trim();
        if (nombre.isEmpty()) throw new DatosInvalidosExcepcion("El nombre es obligatorio.");

        String color = datos.color() == null ? actual.color() : datos.color().trim();
        if (color != null && !color.isEmpty() && !COLOR.matcher(color).matches()) {
            throw new DatosInvalidosExcepcion(
                    "El color debe ser un hexadecimal de seis dígitos, por ejemplo #1A237E.");
        }
        if (color != null) color = color.toUpperCase();

        boolean activa = datos.activa() == null ? actual.activa() : datos.activa();
        coaliciones.actualizar(id, nombre, color, activa);

        if (color != null && !color.equalsIgnoreCase(actual.color())) {
            try {
                coaliciones.propagarColor(id, color);
            } catch (Exception e) {
                log.warn("No se pudo propagar el color de la coalición: {}", e.getMessage());
            }
        }

        return ResponseEntity.ok(coaliciones.buscar(id).orElseThrow());
    }

    /* ------------------------------------------------------------------
     * Logo
     * ------------------------------------------------------------------ */

    @PostMapping(path = "/{id}/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> subirLogo(
            @PathVariable int id, @RequestParam("archivo") MultipartFile archivo) {

        coaliciones.buscar(id).orElseThrow(() -> new NoEncontradoExcepcion("NO_ENCONTRADO",
                "No existe la coalición " + id));

        if (archivo == null || archivo.isEmpty()) {
            throw new DatosInvalidosExcepcion("El archivo está vacío.");
        }
        if (archivo.getSize() > LOGO_MAXIMO) {
            throw new DatosInvalidosExcepcion("El logo no debe pasar de 512 KB.");
        }
        String tipo = archivo.getContentType();
        if (tipo == null || !tipo.startsWith("image/")) {
            throw new DatosInvalidosExcepcion("El logo debe ser una imagen.");
        }

        try {
            byte[] datos = archivo.getBytes();
            coaliciones.guardarLogo(id, datos, tipo);
            coaliciones.propagarLogo(id, datos, tipo);
        } catch (IOException e) {
            throw new DatosInvalidosExcepcion("No se pudo leer el archivo.");
        }

        return ResponseEntity.ok(Map.of("tieneLogo", true));
    }

    @GetMapping("/{id}/logo")
    public ResponseEntity<byte[]> logo(@PathVariable int id) {
        return coaliciones.logo(id)
                .map(l -> ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(l.tipo()))
                        .cacheControl(CacheControl.maxAge(Duration.ofMinutes(10)).cachePublic())
                        .body(l.datos()))
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}/logo")
    public ResponseEntity<Void> borrarLogo(@PathVariable int id) {
        coaliciones.borrarLogo(id);
        return ResponseEntity.noContent().build();
    }
}
