package mx.sirve.servicio;

import mx.sirve.excepcion.DatosInvalidosExcepcion;
import mx.sirve.excepcion.NoEncontradoExcepcion;
import mx.sirve.modelo.dto.CapturistaCrearDTO;
import mx.sirve.modelo.dto.CapturistaDTO;
import mx.sirve.modelo.dto.CasillaAsignadaDTO;
import mx.sirve.repositorio.CapturistaRepositorio;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Alta, edición y asignación de capturistas. */
@Service
@Transactional
public class CapturistaServicio {

    private final CapturistaRepositorio repositorio;

    public CapturistaServicio(CapturistaRepositorio repositorio) {
        this.repositorio = repositorio;
    }

    @Transactional(readOnly = true)
    public List<CapturistaDTO> listar() {
        return repositorio.listar().stream().map(this::conAsignadas).toList();
    }

    @Transactional(readOnly = true)
    public CapturistaDTO obtener(int id) {
        return repositorio.buscar(id).map(this::conAsignadas)
                .orElseThrow(() -> new NoEncontradoExcepcion("NO_ENCONTRADO", "No existe el capturista " + id));
    }

    public CapturistaDTO crear(CapturistaCrearDTO datos) {
        exigirNombre(datos);
        int id = repositorio.insertar(
                datos.nombre().trim(),
                limpiar(datos.telefono()),
                datos.activo() == null || datos.activo());
        if (datos.casillas() != null) {
            repositorio.asignar(id, datos.casillas());
        }
        return obtener(id);
    }

    public CapturistaDTO actualizar(int id, CapturistaCrearDTO datos) {
        exigirNombre(datos);
        obtener(id);
        repositorio.actualizar(
                id,
                datos.nombre().trim(),
                limpiar(datos.telefono()),
                datos.activo() == null || datos.activo());
        if (datos.casillas() != null) {
            repositorio.asignar(id, datos.casillas());
        }
        return obtener(id);
    }

    public void eliminar(int id) {
        obtener(id);
        repositorio.eliminar(id);
    }

    /** Asignación completa: reemplaza la que hubiera. */
    public CapturistaDTO asignar(int id, List<Integer> casillas) {
        obtener(id);
        repositorio.asignar(id, casillas == null ? List.of() : casillas);
        return obtener(id);
    }

    @Transactional(readOnly = true)
    public List<CasillaAsignadaDTO> casillas(int id, int idEleccion) {
        return repositorio.casillas(id, idEleccion);
    }

    /**
     * Las del propio capturista, para el teléfono. No recibe identificador:
     * sale del dispositivo autenticado, así nadie puede pedir las de otro.
     */
    @Transactional(readOnly = true)
    public List<CasillaAsignadaDTO> misCasillas(int idCapturista, int idEleccion) {
        return repositorio.casillas(idCapturista, idEleccion);
    }

    private CapturistaDTO conAsignadas(CapturistaDTO c) {
        return new CapturistaDTO(
                c.id(), c.nombre(), c.telefono(), c.activo(), c.casillas(),
                List.of(), c.creadoEn());
    }

    private void exigirNombre(CapturistaCrearDTO datos) {
        if (datos == null || datos.nombre() == null || datos.nombre().isBlank()) {
            throw new DatosInvalidosExcepcion("El nombre del capturista es obligatorio.");
        }
    }

    private String limpiar(String valor) {
        return (valor == null || valor.isBlank()) ? null : valor.trim();
    }
}
