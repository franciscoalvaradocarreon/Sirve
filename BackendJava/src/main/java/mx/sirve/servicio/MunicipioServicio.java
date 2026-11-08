package mx.sirve.servicio;

import mx.sirve.modelo.dto.MunicipioDTO;
import mx.sirve.repositorio.MunicipioRepositorio;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Municipios con secciones en un proceso. */
@Service
@Transactional(readOnly = true)
public class MunicipioServicio {

    private final MunicipioRepositorio municipioRepositorio;
    private final ProcesoServicio procesoServicio;

    public MunicipioServicio(MunicipioRepositorio municipioRepositorio,
                             ProcesoServicio procesoServicio) {
        this.municipioRepositorio = municipioRepositorio;
        this.procesoServicio = procesoServicio;
    }

    public List<MunicipioDTO> listar(int idProceso) {
        procesoServicio.exigirQueExista(idProceso);
        return municipioRepositorio.listarPorProceso(idProceso);
    }
}