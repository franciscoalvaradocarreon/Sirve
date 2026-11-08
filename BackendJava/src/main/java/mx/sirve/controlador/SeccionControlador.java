package mx.sirve.controlador;

import mx.sirve.modelo.dto.SeccionDTO;
import mx.sirve.servicio.SeccionServicio;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Secciones de un proceso, opcionalmente de un municipio. */
@RestController
@RequestMapping("/api/secciones")
public class SeccionControlador {

    private final SeccionServicio seccionServicio;

    public SeccionControlador(SeccionServicio seccionServicio) {
        this.seccionServicio = seccionServicio;
    }

    @GetMapping
    public ResponseEntity<List<SeccionDTO>> listar(
            @RequestParam(name = "id_proceso") int idProceso,
            @RequestParam(name = "id_municipio", required = false) Integer idMunicipio) {
        return ResponseEntity.ok(seccionServicio.listar(idMunicipio, idProceso));
    }
}