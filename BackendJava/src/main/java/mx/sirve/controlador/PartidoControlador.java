package mx.sirve.controlador;

import mx.sirve.excepcion.DatosInvalidosExcepcion;
import mx.sirve.excepcion.NoEncontradoExcepcion;
import mx.sirve.repositorio.PartidoRepositorio;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Catálogo de partidos.
 *
 * Vive bajo /api/catalogos, así que lo alcanza la regla de roles que ya limita
 * los catálogos a Administrador y Supervisor.
 */
@RestController
@RequestMapping("/api/catalogos/partidos")
public class PartidoControlador {

    /** Mismo formato que exige la restricción de la base. */
    private static final Pattern COLOR = Pattern.compile("^#[0-9A-Fa-f]{6}$");

    /**
     * Lo que llega del navegador.
     *
     * Los campos numéricos van envueltos —Integer, Boolean— y no primitivos:
     * al crear, el cliente no manda identificador ni orden, y un primitivo no
     * admite la ausencia del dato.
     */
    public record Entrada(String clave, String nombre, String color,
                          Integer orden, Boolean activo) {
    }

    private static final org.slf4j.Logger log =
            org.slf4j.LoggerFactory.getLogger(PartidoControlador.class);

    private final PartidoRepositorio partidos;

    public PartidoControlador(PartidoRepositorio partidos) {
        this.partidos = partidos;
    }

    @GetMapping
    public ResponseEntity<List<PartidoRepositorio.Partido>> listar() {
        return ResponseEntity.ok(partidos.listar());
    }

    @PostMapping
    @Transactional
    public ResponseEntity<PartidoRepositorio.Partido> crear(@RequestBody Entrada datos) {

        String clave = limpiar(datos.clave());
        String nombre = limpiar(datos.nombre());
        if (clave.isEmpty() || nombre.isEmpty()) {
            throw new DatosInvalidosExcepcion("La clave y el nombre son obligatorios.");
        }
        if (partidos.claveOcupada(clave)) {
            throw new DatosInvalidosExcepcion("Ya existe un partido con la clave " + clave + ".");
        }

        short orden = datos.orden() == null ? 0 : datos.orden().shortValue();
        int id = partidos.crear(clave.toUpperCase(), nombre, color(datos.color()), orden);
        return ResponseEntity.ok(partidos.buscar(id)
                .orElseThrow(() -> new NoEncontradoExcepcion("NO_ENCONTRADO", "No se creó el partido")));
    }

    /**
     * Actualiza un partido.
     *
     * La clave no se toca: es la que aparece en los nombres de archivo de las
     * actas y en los cruces de la carga, y cambiarla rompería esas referencias.
     */
    /*
     * Sin @Transactional a propósito.
     *
     * Son dos escrituras: el partido y el color de sus boletas. Si la segunda
     * falla —por ejemplo, porque la columna nueva todavía no existe— con
     * transacción la primera también se pierde y el guardado devuelve un error
     * que no explica nada. Suelta, el catálogo se guarda y el color se
     * propagará después.
     */
    @PutMapping("/{id}")
    public ResponseEntity<PartidoRepositorio.Partido> actualizar(
            @PathVariable int id,
            @RequestBody Entrada datos) {

        PartidoRepositorio.Partido actual = partidos.buscar(id)
                .orElseThrow(() -> new NoEncontradoExcepcion("NO_ENCONTRADO",
                        "No existe el partido " + id));

        String nombre = limpiar(datos.nombre());
        if (nombre.isEmpty()) {
            throw new DatosInvalidosExcepcion("El nombre es obligatorio.");
        }

        String color = color(datos.color());
        short orden = datos.orden() == null ? actual.orden() : datos.orden().shortValue();
        boolean activo = datos.activo() == null ? actual.activo() : datos.activo();
        partidos.actualizar(id, nombre, color, orden, activo);

        // El color del catálogo es el oficial: se copia a las boletas para que
        // la gráfica cambie ahora y no en la próxima migración.
        if (color != null && !color.equalsIgnoreCase(actual.color())) {
            try {
                partidos.propagarColor(id, color);
            } catch (Exception e) {
                // Si la columna de color en las boletas todavía no existe, el
                // catálogo se guarda igual: perder el cambio de nombre por eso
                // sería peor. El color se propagará en la siguiente corrida.
                log.warn("No se pudo propagar el color a las boletas: {}", e.getMessage());
            }
        }

        return ResponseEntity.ok(partidos.buscar(id).orElseThrow());
    }

    private String limpiar(String texto) {
        return texto == null ? "" : texto.trim();
    }

    /** Acepta vacío —sin color— o un hexadecimal de seis dígitos. */
    private String color(String valor) {
        String limpio = limpiar(valor);
        if (limpio.isEmpty()) return null;
        if (!COLOR.matcher(limpio).matches()) {
            throw new DatosInvalidosExcepcion(
                    "El color debe ser un hexadecimal de seis dígitos, por ejemplo #0D47A1.");
        }
        return limpio.toUpperCase();
    }
}
