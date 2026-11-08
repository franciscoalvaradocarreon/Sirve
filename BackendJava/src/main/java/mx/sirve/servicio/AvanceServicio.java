package mx.sirve.servicio;

import mx.sirve.modelo.dto.AvanceResumenDTO;
import mx.sirve.repositorio.AvanceRepositorio;
import mx.sirve.repositorio.AvanceRepositorio.Agrupacion;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reporte de avance de una elección. */
@Service
@Transactional(readOnly = true)
public class AvanceServicio {

    private final AvanceRepositorio avanceRepositorio;
    private final EleccionServicio eleccionServicio;

    public AvanceServicio(AvanceRepositorio avanceRepositorio,
                          EleccionServicio eleccionServicio) {
        this.avanceRepositorio = avanceRepositorio;
        this.eleccionServicio = eleccionServicio;
    }

    public AvanceResumenDTO resumir(int idEleccion, String agrupacion) {
        eleccionServicio.exigirQueExista(idEleccion);
        return avanceRepositorio.resumir(idEleccion, interpretar(agrupacion));
    }

    /**
     * Traduce el texto de la petición a la enumeración.
     *
     * Si llega vacío se usa el municipio, que es la vista por omisión. Si llega
     * algo que no se reconoce, se rechaza en lugar de caer al valor por omisión:
     * devolver un reporte de municipios cuando se pidió otra cosa sería peor
     * que un error.
     */
    private Agrupacion interpretar(String agrupacion) {
        if (agrupacion == null || agrupacion.isBlank()) {
            return Agrupacion.MUNICIPIO;
        }
        return switch (agrupacion.trim().toLowerCase()) {
            case "municipio" -> Agrupacion.MUNICIPIO;
            case "distrito_local" -> Agrupacion.DISTRITO_LOCAL;
            case "distrito_federal" -> Agrupacion.DISTRITO_FEDERAL;
            default -> throw new mx.sirve.excepcion.DatosInvalidosExcepcion(
                    "Agrupación desconocida: " + agrupacion
                            + ". Valores: municipio, distrito_local, distrito_federal.");
        };
    }
}
