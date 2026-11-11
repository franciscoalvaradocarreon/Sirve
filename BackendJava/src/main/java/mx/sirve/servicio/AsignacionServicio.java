package mx.sirve.servicio;

import mx.sirve.modelo.dto.AsignacionDTO;
import mx.sirve.repositorio.AsignacionRepositorio;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Reporte de secciones asignadas a los capturistas. */
@Service
@Transactional(readOnly = true)
public class AsignacionServicio {

    private final AsignacionRepositorio repositorio;
    private final EleccionServicio eleccionServicio;

    public AsignacionServicio(AsignacionRepositorio repositorio,
                              EleccionServicio eleccionServicio) {
        this.repositorio = repositorio;
        this.eleccionServicio = eleccionServicio;
    }

    public List<AsignacionDTO> listar(int idEleccion) {
        eleccionServicio.exigirQueExista(idEleccion);
        return repositorio.listar(idEleccion);
    }
}