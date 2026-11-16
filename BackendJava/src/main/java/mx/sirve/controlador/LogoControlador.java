package mx.sirve.controlador;

import mx.sirve.repositorio.PartidoRepositorio;
import mx.sirve.servicio.ParametrosServicio;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/**
 * Logos de las opciones de boleta, para la sala de resultados.
 *
 * Es público como la sala —va en una pantalla donde nadie inicia sesión— y por
 * eso mismo se limita a imágenes ya cargadas: no expone nada más del catálogo.
 *
 * La respuesta se puede cachear: un logo no cambia durante la jornada.
 */
@RestController
@RequestMapping("/api/publico/logo")
public class LogoControlador {

    private final PartidoRepositorio partidos;
    private final ParametrosServicio parametros;

    public LogoControlador(PartidoRepositorio partidos, ParametrosServicio parametros) {
        this.partidos = partidos;
        this.parametros = parametros;
    }

    @GetMapping("/opcion/{idOpcion}")
    public ResponseEntity<byte[]> deOpcion(@PathVariable int idOpcion) {
        if (!parametros.salaHabilitada()) return ResponseEntity.notFound().build();

        return partidos.logoDeOpcion(idOpcion)
                .map(l -> ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(l.tipo()))
                        .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                        .body(l.datos()))
                .orElse(ResponseEntity.notFound().build());
    }
}