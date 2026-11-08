package mx.sirve.servicio;

import mx.sirve.excepcion.DatosInvalidosExcepcion;
import mx.sirve.excepcion.NoEncontradoExcepcion;
import mx.sirve.modelo.dto.CapturaCrearDTO;
import mx.sirve.modelo.dto.CapturaDTO;
import mx.sirve.modelo.dto.OpcionBoletaDTO;
import mx.sirve.modelo.dto.VotoDTO;
import mx.sirve.repositorio.CapturaRepositorio;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Captura de resultados por casilla.
 *
 * Reglas, en el orden en que se aplican:
 *   1. El detalle no puede venir vacío ni con la misma opción repetida.
 *   2. Todas las opciones deben pertenecer a la elección.
 *   3. Los números del acta no pueden ser negativos ni los nulos exceder el total.
 *   4. La suma la calcula el servidor; el cliente no la manda.
 *   5. Si la aritmética no cuadra, se guarda igual y queda marcada.
 */
@Service
public class CapturaServicio {

    private final CapturaRepositorio capturaRepositorio;

    public CapturaServicio(CapturaRepositorio capturaRepositorio) {
        this.capturaRepositorio = capturaRepositorio;
    }

    @Transactional(readOnly = true)
    public CapturaDTO consultar(int idCasilla, int idEleccion) {
        return capturaRepositorio.buscar(idCasilla, idEleccion)
                .orElseThrow(() -> new NoEncontradoExcepcion("NO_ENCONTRADO",
                        "La casilla " + idCasilla + " no tiene captura para la elección " + idEleccion));
    }

    @Transactional(readOnly = true)
    public List<VotoDTO> votos(long idCaptura) {
        return capturaRepositorio.votos(idCaptura);
    }

    /**
     * Guarda o reemplaza. Nunca falla por «ya existe»: la misma casilla se
     * puede recapturar y la anterior se pisa.
     */
    @Transactional
    public CapturaDTO guardar(CapturaCrearDTO datos) {
        validar(datos);

        int suma = datos.votos().stream().mapToInt(VotoDTO::votos).sum();
        int noRegistrados = datos.noRegistrados() == null ? 0 : datos.noRegistrados();
        int nulos = datos.nulos() == null ? 0 : datos.nulos();

        long id;
        try {
            id = capturaRepositorio.guardarCabecera(
                    datos.idCliente().toString(),
                    datos.idCasilla(),
                    datos.idEleccion(),
                    datos.totalActa(),
                    noRegistrados,
                    nulos,
                    suma,
                    datos.autorTexto());
        } catch (DataIntegrityViolationException e) {
            // La llave foránea (id_casilla, id_eleccion) rechaza casillas que no
            // están declaradas para esa elección.
            throw new DatosInvalidosExcepcion("CASILLA_NO_APLICA",
                    "La casilla " + datos.idCasilla() + " no está declarada para la elección "
                            + datos.idEleccion());
        }

        capturaRepositorio.borrarVotos(id);
        capturaRepositorio.guardarVotos(id, datos.votos());

        return capturaRepositorio.buscar(datos.idCasilla(), datos.idEleccion())
                .orElseThrow(() -> new IllegalStateException("La captura no quedó guardada"));
    }

    private void validar(CapturaCrearDTO datos) {
        if (datos.votos() == null || datos.votos().isEmpty()) {
            throw new DatosInvalidosExcepcion("No se enviaron votos por opción");
        }

        Set<Integer> vistas = new HashSet<>();
        for (VotoDTO v : datos.votos()) {
            if (!vistas.add(v.idOpcion())) {
                throw new DatosInvalidosExcepcion(
                        "La opción " + v.idOpcion() + " viene repetida en el detalle");
            }
            if (v.votos() == null || v.votos() < 0) {
                throw new DatosInvalidosExcepcion(
                        "Los votos de la opción " + v.idOpcion() + " no pueden ser negativos");
            }
        }

        List<Integer> ids = datos.votos().stream().map(VotoDTO::idOpcion).toList();
        List<OpcionBoletaDTO> validas = capturaRepositorio.opcionesDeLaEleccion(datos.idEleccion(), ids);
        if (validas.size() != ids.size()) {
            throw new DatosInvalidosExcepcion("OPCION_FUERA_DE_ELECCION",
                    "Alguna opción enviada no pertenece a la elección " + datos.idEleccion());
        }

        int nulos = datos.nulos() == null ? 0 : datos.nulos();
        if (nulos > datos.totalActa()) {
            throw new DatosInvalidosExcepcion(
                    "Los votos nulos (" + nulos + ") no pueden exceder el total del acta ("
                            + datos.totalActa() + ")");
        }
    }
}
