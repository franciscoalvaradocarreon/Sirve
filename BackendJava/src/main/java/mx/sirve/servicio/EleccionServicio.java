package mx.sirve.servicio;

import mx.sirve.excepcion.NoEncontradoExcepcion;
import mx.sirve.modelo.dto.EleccionDTO;
import mx.sirve.modelo.dto.OpcionBoletaDTO;
import mx.sirve.repositorio.EleccionRepositorio;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Elecciones y su boleta. */
@Service
@Transactional(readOnly = true)
public class EleccionServicio {

    private final EleccionRepositorio eleccionRepositorio;

    public EleccionServicio(EleccionRepositorio eleccionRepositorio) {
        this.eleccionRepositorio = eleccionRepositorio;
    }

    public List<EleccionDTO> listarPorProceso(int idProceso) {
        return eleccionRepositorio.listarPorProceso(idProceso);
    }

    public List<OpcionBoletaDTO> listarOpciones(int idEleccion) {
        exigirQueExista(idEleccion);
        return eleccionRepositorio.opciones(idEleccion);
    }

    public void exigirQueExista(int idEleccion) {
        if (!eleccionRepositorio.existe(idEleccion)) {
            throw new NoEncontradoExcepcion("NO_ENCONTRADO",
                    "No existe la elección " + idEleccion);
        }
    }
}