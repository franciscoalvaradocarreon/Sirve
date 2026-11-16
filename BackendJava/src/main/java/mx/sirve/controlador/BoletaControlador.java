package mx.sirve.controlador;

import mx.sirve.excepcion.DatosInvalidosExcepcion;
import mx.sirve.excepcion.NoEncontradoExcepcion;
import mx.sirve.repositorio.BoletaRepositorio;
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
 * Qué aparece en la boleta de cada elección.
 *
 * Bajo /api/catalogos, con la regla de roles de los catálogos.
 *
 * Dos reglas que protegen los datos:
 *
 * · Una opción con votos capturados no se borra, se desactiva. Borrarla dejaría
 *   capturas apuntando a una opción que ya no existe.
 *
 * · La clave de una opción se escribe al crearla y no se cambia: es la que el
 *   capturista lee en el acta y la que aparece en los archivos de las fotos.
 */
@RestController
@RequestMapping("/api/catalogos/boletas")
public class BoletaControlador {

    private static final Pattern COLOR = Pattern.compile("^#[0-9A-Fa-f]{6}$");
    private static final long LOGO_MAXIMO = 512 * 1024;

    /** Lo que se cambia de una opción ya creada. */
    public record Cambio(String etiqueta, String color, Short orden, Boolean activo) {
    }

    /** Alta de un partido: se elige del catálogo. */
    public record NuevoPartido(Integer idPartido) {
    }

    /** Alta de una coalición: se arma con partidos. */
    public record NuevaCoalicion(String clave, String nombre, String color, List<Integer> idPartidos) {
    }

    private final BoletaRepositorio boletas;

    public BoletaControlador(BoletaRepositorio boletas) {
        this.boletas = boletas;
    }

    @GetMapping("/elecciones")
    public ResponseEntity<List<Map<String, Object>>> elecciones() {
        return ResponseEntity.ok(boletas.elecciones());
    }

    @GetMapping("/{idEleccion}")
    public ResponseEntity<Map<String, Object>> deEleccion(@PathVariable int idEleccion) {
        boletas.eleccion(idEleccion);

        return ResponseEntity.ok(Map.of(
                "opciones", boletas.deEleccion(idEleccion),
                "disponibles", boletas.partidosDisponibles(idEleccion)));
    }

    /** Agrega un partido del catálogo a la boleta. */
    @PostMapping("/{idEleccion}/partido")
    public ResponseEntity<Map<String, Object>> agregarPartido(
            @PathVariable int idEleccion, @RequestBody NuevoPartido datos) {

        if (datos.idPartido() == null) {
            throw new DatosInvalidosExcepcion("Falta el partido.");
        }

        Map<String, Object> disponibles = boletas.partidosDisponibles(idEleccion).stream()
                .filter(p -> ((Number) p.get("id")).intValue() == datos.idPartido())
                .findFirst()
                .orElseThrow(() -> new DatosInvalidosExcepcion(
                        "Ese partido ya está en la boleta o no existe."));

        int id = boletas.agregarPartido(idEleccion, datos.idPartido(),
                String.valueOf(disponibles.get("clave")), boletas.siguienteOrden(idEleccion));

        return ResponseEntity.ok(Map.of("id", id));
    }

    /** Crea una coalición para el proceso de la elección y la agrega a la boleta. */
    @PostMapping("/{idEleccion}/coalicion")
    public ResponseEntity<Map<String, Object>> agregarCoalicion(
            @PathVariable int idEleccion, @RequestBody NuevaCoalicion datos) {

        String clave = datos.clave() == null ? "" : datos.clave().trim().toUpperCase();
        if (clave.isEmpty()) {
            throw new DatosInvalidosExcepcion("La clave de la coalición es obligatoria.");
        }
        if (boletas.etiquetaOcupada(idEleccion, clave)) {
            throw new DatosInvalidosExcepcion("Ya hay una opción con la clave " + clave + ".");
        }
        if (datos.idPartidos() == null || datos.idPartidos().isEmpty()) {
            throw new DatosInvalidosExcepcion("Una coalición necesita al menos un partido.");
        }

        String color = datos.color() == null ? "#546E7A" : datos.color().trim().toUpperCase();
        if (!COLOR.matcher(color).matches()) {
            throw new DatosInvalidosExcepcion(
                    "El color debe ser un hexadecimal de seis dígitos, por ejemplo #1A237E.");
        }

        Map<String, Object> eleccion = boletas.eleccion(idEleccion);
        int idProceso = ((Number) eleccion.get("id_proceso")).intValue();

        int id = boletas.agregarCoalicion(idEleccion, idProceso, clave,
                datos.idPartidos(), color, boletas.siguienteOrden(idEleccion));

        // El logo de la coalición, si ya tenía uno en el catálogo.
        if (id > 0) {
            boletas.buscar(id).flatMap(o -> o.idCoalicion() == null
                            ? java.util.Optional.<Integer>empty()
                            : java.util.Optional.of(o.idCoalicion()))
                    .ifPresent(idCoalicion -> boletas.copiarLogoDeCoalicion(id, idCoalicion));
        }

        return ResponseEntity.ok(Map.of("id", id));
    }

    @PutMapping("/opcion/{id}")
    public ResponseEntity<BoletaRepositorio.Opcion> actualizar(
            @PathVariable int id, @RequestBody Cambio datos) {

        BoletaRepositorio.Opcion actual = boletas.buscar(id)
                .orElseThrow(() -> new NoEncontradoExcepcion("NO_ENCONTRADO",
                        "No existe la opción " + id));

        String etiqueta = datos.etiqueta() == null ? actual.etiqueta() : datos.etiqueta().trim();
        if (etiqueta.isEmpty()) throw new DatosInvalidosExcepcion("La clave es obligatoria.");

        String color = datos.color() == null ? actual.color() : datos.color().trim().toUpperCase();
        if (color != null && !color.isEmpty() && !COLOR.matcher(color).matches()) {
            throw new DatosInvalidosExcepcion(
                    "El color debe ser un hexadecimal de seis dígitos, por ejemplo #0D47A1.");
        }

        short orden = datos.orden() == null ? actual.orden() : datos.orden();
        boolean activo = datos.activo() == null ? actual.activo() : datos.activo();

        boletas.actualizar(id, etiqueta, color, orden, activo);
        return ResponseEntity.ok(boletas.buscar(id).orElseThrow());
    }

    /**
     * Quita una opción de la boleta.
     *
     * Solo si no tiene votos. Con votos, el camino es desactivarla: la captura
     * deja de ofrecerla y lo ya registrado se conserva.
     */
    @DeleteMapping("/opcion/{id}")
    public ResponseEntity<Map<String, Object>> quitar(@PathVariable int id) {
        boletas.buscar(id).orElseThrow(() -> new NoEncontradoExcepcion("NO_ENCONTRADO",
                "No existe la opción " + id));

        int votos = boletas.votosRegistrados(id);
        if (votos > 0) {
            throw new DatosInvalidosExcepcion(
                    "Esa opción tiene " + votos + " votos capturados. Desactívala en lugar de borrarla.");
        }

        boletas.borrar(id);
        return ResponseEntity.ok(Map.of("borrada", true));
    }

    /* ------------------------------------------------------------------
     * Logo de la opción
     * ------------------------------------------------------------------ */

    @PostMapping(path = "/opcion/{id}/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> subirLogo(
            @PathVariable int id, @RequestParam("archivo") MultipartFile archivo) {

        boletas.buscar(id).orElseThrow(() -> new NoEncontradoExcepcion("NO_ENCONTRADO",
                "No existe la opción " + id));

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
            boletas.guardarLogo(id, archivo.getBytes(), tipo);
        } catch (IOException e) {
            throw new DatosInvalidosExcepcion("No se pudo leer el archivo.");
        }
        return ResponseEntity.ok(Map.of("tieneLogo", true));
    }

    @GetMapping("/opcion/{id}/logo")
    public ResponseEntity<byte[]> logo(@PathVariable int id) {
        return boletas.logo(id)
                .map(l -> ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(l.tipo()))
                        .cacheControl(CacheControl.maxAge(Duration.ofMinutes(10)).cachePublic())
                        .body(l.datos()))
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/opcion/{id}/logo")
    public ResponseEntity<Void> borrarLogo(@PathVariable int id) {
        boletas.borrarLogo(id);
        return ResponseEntity.noContent().build();
    }
}
