package mx.sirve.servicio;

import mx.sirve.excepcion.NoEncontradoExcepcion;
import mx.sirve.modelo.dto.ProcesoDTO;
import mx.sirve.repositorio.ProcesoRepositorio;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Procesos electorales. */
@Service
@Transactional(readOnly = true)
public class ProcesoServicio {

    private final ProcesoRepositorio procesoRepositorio;

    public ProcesoServicio(ProcesoRepositorio procesoRepositorio) {
        this.procesoRepositorio = procesoRepositorio;
    }

    public List<ProcesoDTO> listar() {
        return procesoRepositorio.listar();
    }

    /** Falla con 404 si el proceso no existe; lo usan los demás servicios. */
    public void exigirQueExista(int idProceso) {
        if (!procesoRepositorio.existe(idProceso)) {
            throw new NoEncontradoExcepcion("NO_ENCONTRADO",
                    "No existe el proceso electoral " + idProceso);
        }
    }
}