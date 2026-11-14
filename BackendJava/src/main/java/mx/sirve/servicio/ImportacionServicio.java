package mx.sirve.servicio;

import mx.sirve.excepcion.DatosInvalidosExcepcion;
import mx.sirve.modelo.dto.ImportacionDTO;
import mx.sirve.repositorio.CapturistaRepositorio;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Alta masiva de capturistas.
 *
 * Trae tres cuidados que no se ven en un alta individual:
 *
 * · Una fila mala no cancela el resto. Con 300 renglones, abortar todo por un
 *   teléfono mal escrito obligaría a corregir y volver a empezar; se informa
 *   el renglón y siguen los demás.
 *
 * · Las secciones se resuelven en una sola consulta. Una por renglón serían
 *   miles de viajes a la base.
 *
 * · Repetir la importación no duplica. Si el nombre ya existe, se salta en
 *   lugar de crear un segundo «María Garza».
 */
@Service
public class ImportacionServicio {

    private final CapturistaRepositorio capturistas;

    public ImportacionServicio(CapturistaRepositorio capturistas) {
        this.capturistas = capturistas;
    }

    @Transactional
    public ImportacionDTO.Resultado importar(List<ImportacionDTO.Fila> filas) {
        if (filas == null || filas.isEmpty()) {
            throw new DatosInvalidosExcepcion("SIN_FILAS", "El archivo no trae renglones.");
        }

        Optional<Integer> proceso = capturistas.procesoActivo();
        if (proceso.isEmpty()) {
            throw new DatosInvalidosExcepcion("SIN_PROCESO",
                    "No hay un proceso electoral activo: no se sabe a qué año pertenecen las secciones.");
        }

        // Todas las claves del archivo, sin repetir, para resolverlas de golpe.
        Set<String> claves = new LinkedHashSet<>();
        for (ImportacionDTO.Fila fila : filas) {
            if (fila.secciones() != null) {
                for (String c : fila.secciones()) {
                    if (c != null && !c.isBlank()) claves.add(c.trim());
                }
            }
        }

        Map<String, Integer> ids = capturistas.idsPorClave(new ArrayList<>(claves), proceso.get());

        List<String> errores = new ArrayList<>();
        int creados = 0;
        int asignadas = 0;
        int compartidas = 0;

        for (int i = 0; i < filas.size(); i++) {
            ImportacionDTO.Fila fila = filas.get(i);
            int renglon = i + 2; // +2: la primera línea del archivo es el encabezado

            String nombre = fila.nombre() == null ? "" : fila.nombre().trim();
            if (nombre.isEmpty()) {
                errores.add("Renglón " + renglon + ": sin nombre.");
                continue;
            }
            if (capturistas.existeNombre(nombre)) {
                errores.add("Renglón " + renglon + ": ya existe un capturista llamado «" + nombre + "».");
                continue;
            }

            List<Integer> idsFila = new ArrayList<>();
            boolean claveMala = false;
            if (fila.secciones() != null) {
                for (String c : fila.secciones()) {
                    if (c == null || c.isBlank()) continue;
                    Integer id = ids.get(c.trim());
                    if (id == null) {
                        errores.add("Renglón " + renglon + ": la sección «" + c.trim() + "» no existe.");
                        claveMala = true;
                    } else {
                        idsFila.add(id);
                    }
                }
            }
            if (claveMala) continue;
            if (idsFila.isEmpty()) {
                errores.add("Renglón " + renglon + ": no tiene ninguna sección válida.");
                continue;
            }

            String telefono = fila.telefono() == null ? null : fila.telefono().trim();
            if (telefono != null && telefono.isEmpty()) telefono = null;

            int id = capturistas.insertar(nombre, telefono, true);
            for (int idSeccion : idsFila) {
                if (capturistas.otrosConSeccion(idSeccion) > 0) compartidas++;
                capturistas.asignarSeccion(id, idSeccion);
                asignadas++;
            }
            creados++;
        }

        return new ImportacionDTO.Resultado(creados, asignadas, compartidas, errores);
    }
}
