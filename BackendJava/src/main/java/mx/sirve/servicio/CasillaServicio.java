package mx.sirve.servicio;

import mx.sirve.modelo.dto.CasillaDTO;
import mx.sirve.repositorio.CasillaRepositorio;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Casillas de una elección. */
@Service
@Transactional(readOnly = true)
public class CasillaServicio {

    private final CasillaRepositorio casillaRepositorio;
    private final EleccionServicio eleccionServicio;

    public CasillaServicio(CasillaRepositorio casillaRepositorio,
                           EleccionServicio eleccionServicio) {
        this.casillaRepositorio = casillaRepositorio;
        this.eleccionServicio = eleccionServicio;
    }

    public List<CasillaDTO> listar(int idEleccion, Integer idMunicipio, String seccion,
                                   String distritoLocal, String distritoFederal) {
        eleccionServicio.exigirQueExista(idEleccion);
        return casillaRepositorio.listar(idEleccion, idMunicipio, vacio(seccion),
                vacio(distritoLocal), vacio(distritoFederal));
    }

    private String vacio(String valor) {
        return (valor == null || valor.isBlank()) ? null : valor.trim();
    }
}