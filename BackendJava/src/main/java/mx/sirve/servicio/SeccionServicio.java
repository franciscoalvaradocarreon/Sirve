package mx.sirve.servicio;

import mx.sirve.modelo.dto.SeccionDTO;
import mx.sirve.repositorio.SeccionRepositorio;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Secciones de un proceso. */
@Service
@Transactional(readOnly = true)
public class SeccionServicio {

    private final SeccionRepositorio seccionRepositorio;
    private final ProcesoServicio procesoServicio;

    public SeccionServicio(SeccionRepositorio seccionRepositorio,
                           ProcesoServicio procesoServicio) {
        this.seccionRepositorio = seccionRepositorio;
        this.procesoServicio = procesoServicio;
    }

    /**
     * Secciones del proceso. Si idMunicipio es nulo, devuelve todas.
     */
    public List<SeccionDTO> listar(Integer idMunicipio, int idProceso) {
        procesoServicio.exigirQueExista(idProceso);
        return seccionRepositorio.listar(idMunicipio, idProceso);
    }
}