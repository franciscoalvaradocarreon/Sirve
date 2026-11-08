package mx.sirve.controlador;

import mx.sirve.modelo.dto.CasillaDTO;
import mx.sirve.servicio.CasillaServicio;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Casillas de una elección, con filtros opcionales. */
@RestController
@RequestMapping("/api/casillas")
public class CasillaControlador {

    private final CasillaServicio casillaServicio;

    public CasillaControlador(CasillaServicio casillaServicio) {
        this.casillaServicio = casillaServicio;
    }

    @GetMapping
    public ResponseEntity<List<CasillaDTO>> listar(
            @RequestParam(name = "id_eleccion") int idEleccion,
            @RequestParam(name = "id_municipio", required = false) Integer idMunicipio,
            @RequestParam(name = "seccion", required = false) String seccion,
            @RequestParam(name = "distrito_local", required = false) String distritoLocal,
            @RequestParam(name = "distrito_federal", required = false) String distritoFederal) {
        return ResponseEntity.ok(
                casillaServicio.listar(idEleccion, idMunicipio, seccion,
                        distritoLocal, distritoFederal));
    }
}