package mx.sirve.controlador;

import mx.sirve.modelo.dto.HistorialCambioDTO;
import mx.sirve.repositorio.CapturaHistorialRepositorio;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Consulta de la traza de capturas.
 *
 * Va bajo /api/reportes a propósito: el filtro de sesión ya limita ese prefijo
 * a quien coordina, analiza o audita. Un capturista no necesita ver quién más
 * tocó la casilla, y el teléfono menos.
 *
 * La escribe un trigger; aquí solo se lee.
 */
@RestController
@RequestMapping("/api/reportes/capturas/historial")
public class CapturaHistorialControlador {

    private static final int LIMITE_POR_OMISION = 50;
    private static final int LIMITE_MAXIMO = 500;

    private final CapturaHistorialRepositorio historial;

    public CapturaHistorialControlador(CapturaHistorialRepositorio historial) {
        this.historial = historial;
    }

    /**
     * Cambios filtrados por municipio, sección, casilla y elección.
     *
     * Todos los filtros son opcionales: sin ninguno devuelve lo más reciente del
     * sistema, que es lo que sirve para revisar la jornada en caliente.
     */
    @GetMapping
    public HistorialCambioDTO.Pagina buscar(
            @RequestParam(name = "id_municipio", required = false) Integer idMunicipio,
            @RequestParam(required = false) String seccion,
            @RequestParam(required = false) String casilla,
            @RequestParam(name = "id_eleccion", required = false) Integer idEleccion,
            @RequestParam(defaultValue = "0") int limite) {
        return historial.buscar(idMunicipio, seccion, casilla, idEleccion, acotar(limite));
    }

    /** Todo lo que le pasó a una casilla en una elección, lo más reciente primero. */
    @GetMapping("/{idCasilla}/{idEleccion}")
    public List<Map<String, Object>> deCasilla(@PathVariable int idCasilla,
                                               @PathVariable int idEleccion,
                                               @RequestParam(defaultValue = "0") int limite) {
        return historial.deCasilla(idCasilla, idEleccion, acotar(limite));
    }

    /** Los últimos cambios de todo el sistema, para revisar la jornada. */
    @GetMapping("/recientes")
    public List<Map<String, Object>> recientes(@RequestParam(defaultValue = "0") int limite) {
        return historial.recientes(acotar(limite));
    }

    private static int acotar(int limite) {
        if (limite <= 0) return LIMITE_POR_OMISION;
        return Math.min(limite, LIMITE_MAXIMO);
    }
}
