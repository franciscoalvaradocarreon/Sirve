package mx.sirve.controlador;

import mx.sirve.repositorio.AvanceOperacionRepositorio;
import mx.sirve.servicio.EleccionServicio;
import org.springframework.beans.factory.annotation.Value;
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
 * Tiene un interruptor —app.sala.habilitada— para que la página pueda existir
 * desde antes sin estar publicando cifras. El día de la jornada se enciende;
 * hasta entonces responde «sin publicar».
 */
@RestController
@RequestMapping("/api/publico/sala")
public class SalaControlador {

    private final AvanceOperacionRepositorio consultas;
    private final EleccionServicio elecciones;

    @Value("${app.sala.habilitada:false}")
    private boolean habilitada;

    public SalaControlador(AvanceOperacionRepositorio consultas, EleccionServicio elecciones) {
        this.consultas = consultas;
        this.elecciones = elecciones;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> sala(
            @RequestParam(name = "id_eleccion") int idEleccion) {

        Map<String, Object> respuesta = new LinkedHashMap<>();
        respuesta.put("habilitada", habilitada);
        respuesta.put("servidor", OffsetDateTime.now());

        if (!habilitada) return ResponseEntity.ok(respuesta);

        elecciones.exigirQueExista(idEleccion);

        Map<String, Object> totales = consultas.totales(idEleccion);
        long total = numero(totales.get("total"));
        long capturadas = numero(totales.get("capturadas"));

        respuesta.put("eleccion", consultas.nombreEleccion(idEleccion));
        respuesta.put("total", total);
        respuesta.put("capturadas", capturadas);
        respuesta.put("avance", total == 0 ? 0 : Math.round(capturadas * 1000.0 / total) / 10.0);
        respuesta.put("conFoto", numero(totales.get("con_foto")));
        respuesta.put("ultima", totales.get("ultima"));

        // Resultados con su porcentaje ya calculado: el navegador solo dibuja.
        List<Map<String, Object>> filas = consultas.resultados(idEleccion);
        long suma = filas.stream().mapToLong(f -> numero(f.get("votos"))).sum();
        List<Map<String, Object>> resultados = filas.stream().map(f -> {
            Map<String, Object> r = new LinkedHashMap<>();
            long votos = numero(f.get("votos"));
            r.put("etiqueta", f.get("etiqueta"));
            r.put("votos", votos);
            r.put("porcentaje", suma == 0 ? 0 : Math.round(votos * 1000.0 / suma) / 10.0);
            return r;
        }).toList();
        respuesta.put("resultados", resultados);
        respuesta.put("votosTotales", suma);

        respuesta.put("municipios", consultas.porMunicipio(idEleccion));
        respuesta.put("porHora", consultas.porHora(idEleccion));

        return ResponseEntity.ok(respuesta);
    }

    private long numero(Object valor) {
        return valor == null ? 0L : ((Number) valor).longValue();
    }
}