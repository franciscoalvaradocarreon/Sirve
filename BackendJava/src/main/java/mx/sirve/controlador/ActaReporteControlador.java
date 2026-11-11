package mx.sirve.controlador;

import mx.sirve.modelo.dto.ActaReporteDTO;
import mx.sirve.repositorio.ActaReporteRepositorio;
import mx.sirve.servicio.EleccionServicio;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Reporte de actas con foto registrada. */
@RestController
@RequestMapping("/api/reportes/actas")
public class ActaReporteControlador {

    private final ActaReporteRepositorio repositorio;
    private final EleccionServicio elecciones;

    public ActaReporteControlador(ActaReporteRepositorio repositorio,
                                  EleccionServicio elecciones) {
        this.repositorio = repositorio;
        this.elecciones = elecciones;
    }

    @GetMapping
    public ResponseEntity<List<ActaReporteDTO>> listar(
            @RequestParam(name = "id_eleccion") int idEleccion) {
        elecciones.exigirQueExista(idEleccion);
        return ResponseEntity.ok(repositorio.listar(idEleccion));
    }
}