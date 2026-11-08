package mx.sirve.servicio;

import mx.sirve.excepcion.DatosInvalidosExcepcion;
import mx.sirve.modelo.dto.DistritoDTO;
import mx.sirve.repositorio.DistritoRepositorio;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

/** Distritos electorales. */
@Service
@Transactional(readOnly = true)
public class DistritoServicio {

    /** Los únicos tipos que se listan; municipal no se usa en captura. */
    private static final Set<String> TIPOS = Set.of("LOCAL", "FEDERAL");

    private final DistritoRepositorio distritoRepositorio;
    private final ProcesoServicio procesoServicio;

    public DistritoServicio(DistritoRepositorio distritoRepositorio,
                            ProcesoServicio procesoServicio) {
        this.distritoRepositorio = distritoRepositorio;
        this.procesoServicio = procesoServicio;
    }

    public List<DistritoDTO> listar(String tipo, int idProceso) {
        String normalizado = tipo == null ? "" : tipo.trim().toUpperCase();
        if (!TIPOS.contains(normalizado)) {
            throw new DatosInvalidosExcepcion(
                    "El tipo de distrito debe ser LOCAL o FEDERAL, no '" + tipo + "'");
        }
        procesoServicio.exigirQueExista(idProceso);
        return distritoRepositorio.listar(normalizado, idProceso);
    }
}