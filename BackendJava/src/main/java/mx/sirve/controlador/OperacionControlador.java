package mx.sirve.controlador;

import mx.sirve.repositorio.AvanceOperacionRepositorio;
import mx.sirve.servicio.EleccionServicio;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tablero de operación: cómo va la captura, para quien coordina.
 *
 * Vive bajo /api/reportes, así que lo alcanza la misma regla de roles que los
 * demás reportes: Administrador, Supervisor, Analista y Auditor.
 *
 * Responde a «¿dónde actuamos?», no a «¿cuánto llevamos?»: por eso trae las
 * secciones atrasadas y las actas que no cuadran, que es lo que pide mandar a
 * alguien o revisar algo.
 */
@RestController
@RequestMapping("/api/reportes/operacion")
public class OperacionControlador {

    private final AvanceOperacionRepositorio consultas;
    private final EleccionServicio elecciones;

    public OperacionControlador(AvanceOperacionRepositorio consultas, EleccionServicio elecciones) {
        this.consultas = consultas;
        this.elecciones = elecciones;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> operacion(
            @RequestParam(name = "id_eleccion") int idEleccion) {

        elecciones.exigirQueExista(idEleccion);

        Map<String, Object> totales = consultas.totales(idEleccion);
        long total = numero(totales.get("total"));
        long capturadas = numero(totales.get("capturadas"));

        Map<String, Object> respuesta = new LinkedHashMap<>();
        respuesta.put("eleccion", consultas.nombreEleccion(idEleccion));
        respuesta.put("total", total);
        respuesta.put("capturadas", capturadas);
        respuesta.put("avance", total == 0 ? 0 : Math.round(capturadas * 1000.0 / total) / 10.0);
        respuesta.put("conFoto", numero(totales.get("con_foto")));
        respuesta.put("sinCuadrar", numero(totales.get("sin_cuadrar")));
        respuesta.put("ultima", totales.get("ultima"));
        respuesta.put("municipios", consultas.porMunicipio(idEleccion));
        respuesta.put("porHora", consultas.porHora(idEleccion));
        respuesta.put("atrasadas", consultas.seccionesAtrasadas(idEleccion, 12));
        respuesta.put("descuadradas", consultas.sinCuadrar(idEleccion, 12));

        List<Map<String, Object>> filas = consultas.resultados(idEleccion);
        long suma = filas.stream().mapToLong(f -> numero(f.get("votos"))).sum();
        respuesta.put("votosTotales", suma);
        respuesta.put("resultados", filas.stream().map(f -> {
            Map<String, Object> r = new LinkedHashMap<>();
            long votos = numero(f.get("votos"));
            r.put("etiqueta", f.get("etiqueta"));
            r.put("votos", votos);
            r.put("porcentaje", suma == 0 ? 0 : Math.round(votos * 1000.0 / suma) / 10.0);
            return r;
        }).toList());

        return ResponseEntity.ok(respuesta);
    }

    private long numero(Object valor) {
        return valor == null ? 0L : ((Number) valor).longValue();
    }
}