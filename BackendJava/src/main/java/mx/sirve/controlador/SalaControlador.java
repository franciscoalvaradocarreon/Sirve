package mx.sirve.controlador;

import mx.sirve.repositorio.AvanceOperacionRepositorio;
import mx.sirve.repositorio.AvanceOperacionRepositorio.Ambito;
import mx.sirve.servicio.EleccionServicio;
import mx.sirve.servicio.ParametrosServicio;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Sala de resultados: la pantalla pública.
 *
 * Abierta a propósito, como el móvil, porque va en una pantalla en una sala y
 * no hay quién inicie sesión ahí. Publica SOLO agregados: porcentajes, avance
 * y hora de la última acta. Ni nombres, ni actas, ni resultados por casilla.
 *
 * Tiene un interruptor —sala.habilitada en los parámetros— para que la página
 * pueda existir desde antes sin estar publicando cifras.
 *
 * Cada elección se mira a su escala: Gobernatura por todo el estado, las
 * diputaciones por distrito y los ayuntamientos por municipio.
 */
@RestController
@RequestMapping("/api/publico/sala")
public class SalaControlador {

    private final AvanceOperacionRepositorio consultas;
    private final EleccionServicio elecciones;
    private final ParametrosServicio parametros;

    public SalaControlador(AvanceOperacionRepositorio consultas, EleccionServicio elecciones,
                           ParametrosServicio parametros) {
        this.consultas = consultas;
        this.elecciones = elecciones;
        this.parametros = parametros;
    }

    /**
     * Elecciones que la sala puede mostrar, con su alcance.
     *
     * El combo de la pantalla pública no puede usar /api/elecciones: esa ruta
     * exige credencial, y en la sala no hay nadie que inicie sesión.
     */
    @GetMapping("/elecciones")
    public ResponseEntity<List<Map<String, Object>>> elecciones() {
        if (!parametros.salaHabilitada()) return ResponseEntity.ok(List.of());

        return ResponseEntity.ok(consultas.eleccionesPublicables().stream().map(e -> {
            Map<String, Object> fila = new LinkedHashMap<>(e);
            fila.put("alcance", alcance(String.valueOf(e.get("tipo"))));
            return fila;
        }).toList());
    }

    /**
     * Distritos o municipios entre los que se puede elegir.
     *
     * Gobernatura devuelve una lista vacía: se mira completa, no por partes.
     */
    @GetMapping("/opciones")
    public ResponseEntity<Map<String, Object>> opciones(
            @RequestParam(name = "id_eleccion") int idEleccion) {

        Map<String, Object> respuesta = new LinkedHashMap<>();
        respuesta.put("habilitada", parametros.salaHabilitada());

        if (!parametros.salaHabilitada()) return ResponseEntity.ok(respuesta);

        elecciones.exigirQueExista(idEleccion);
        String tipo = consultas.tipoEleccion(idEleccion);
        String alcance = alcance(tipo);

        respuesta.put("alcance", alcance);
        respuesta.put("opciones", switch (alcance) {
            case "DISTRITO_LOCAL" -> consultas.distritos("LOCAL");
            case "DISTRITO_FEDERAL" -> consultas.distritos("FEDERAL");
            case "MUNICIPIO" -> consultas.municipiosDe(idEleccion);
            default -> List.of();
        });

        return ResponseEntity.ok(respuesta);
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> sala(
            @RequestParam(name = "id_eleccion") int idEleccion,
            @RequestParam(name = "id_ambito", required = false) Integer idAmbito) {

        Map<String, Object> respuesta = new LinkedHashMap<>();
        respuesta.put("habilitada", parametros.salaHabilitada());
        respuesta.put("servidor", OffsetDateTime.now());

        if (!parametros.salaHabilitada()) {
            respuesta.put("mensaje", parametros.salaMensaje());
            return ResponseEntity.ok(respuesta);
        }

        elecciones.exigirQueExista(idEleccion);
        Ambito ambito = ambitoDe(idEleccion, idAmbito);

        Map<String, Object> totales = consultas.totales(idEleccion, ambito);
        long total = numero(totales.get("total"));
        long capturadas = numero(totales.get("capturadas"));

        respuesta.put("eleccion", consultas.nombreEleccion(idEleccion));
        respuesta.put("alcance", alcance(consultas.tipoEleccion(idEleccion)));
        respuesta.put("total", total);
        respuesta.put("capturadas", capturadas);
        respuesta.put("avance", total == 0 ? 0 : Math.round(capturadas * 1000.0 / total) / 10.0);
        respuesta.put("conFoto", numero(totales.get("con_foto")));
        respuesta.put("ultima", totales.get("ultima"));

        List<Map<String, Object>> filas = consultas.resultados(idEleccion, ambito);
        long suma = filas.stream().mapToLong(f -> numero(f.get("votos"))).sum();
        respuesta.put("resultados", filas.stream().map(f -> {
            Map<String, Object> r = new LinkedHashMap<>();
            long votos = numero(f.get("votos"));
            r.put("etiqueta", f.get("etiqueta"));
            r.put("color", f.get("color"));
            r.put("votos", votos);
            r.put("porcentaje", suma == 0 ? 0 : Math.round(votos * 1000.0 / suma) / 10.0);
            return r;
        }).toList());
        respuesta.put("votosTotales", suma);

        respuesta.put("municipios", consultas.porMunicipio(idEleccion, ambito));
        respuesta.put("porHora", consultas.porHora(idEleccion, ambito));

        return ResponseEntity.ok(respuesta);
    }

    /**
     * Alcance según el tipo de elección.
     *
     * Se compara con el valor nulo antes del switch: una elección de estado
     * —Gobernatura— no tiene columna de ámbito, y elegir sobre nulo revienta.
     */
    private String alcance(String tipo) {
        String columna = AvanceOperacionRepositorio.columnaDeAmbito(tipo);
        if (columna == null) return "ESTADO";

        return switch (columna) {
            case "id_distrito_local" -> "DISTRITO_LOCAL";
            case "id_distrito_federal" -> "DISTRITO_FEDERAL";
            case "id_municipio" -> "MUNICIPIO";
            default -> "ESTADO";
        };
    }

    /**
     * Traduce el número recibido en un filtro.
     *
     * El cliente manda un identificador; la columna la decide el tipo de
     * elección, no el cliente. Así una dirección manipulada no puede filtrar
     * por una columna arbitraria.
     */
    private Ambito ambitoDe(int idEleccion, Integer idAmbito) {
        String columna = AvanceOperacionRepositorio.columnaDeAmbito(
                consultas.tipoEleccion(idEleccion));

        if (columna == null || idAmbito == null) return Ambito.TODO;
        return new Ambito(columna, idAmbito);
    }

    private long numero(Object valor) {
        return valor == null ? 0L : ((Number) valor).longValue();
    }
}
