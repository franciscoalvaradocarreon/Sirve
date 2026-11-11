package mx.sirve.servicio;

import mx.sirve.excepcion.DatosInvalidosExcepcion;
import mx.sirve.excepcion.NoEncontradoExcepcion;
import mx.sirve.repositorio.ActaFotoRepositorio;
import mx.sirve.repositorio.CapturistaRepositorio;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.text.Normalizer;
import java.util.Map;

/**
 * Fotos de acta.
 *
 * El archivo se guarda en disco, en una carpeta por proceso, con un nombre que
 * dice todo sin abrir nada:
 *
 *     2027/2027-GOB-040-1258-B.jpg
 *     año  elección municipio sección casilla
 *
 * Se escribe primero en un archivo temporal y luego se renombra, para que una
 * subida cortada no deje una imagen a medias con el nombre definitivo.
 */
@Service
public class ActaFotoServicio {

    private final ActaFotoRepositorio repositorio;
    private final CapturistaRepositorio capturistas;
    private final Path base;

    public ActaFotoServicio(ActaFotoRepositorio repositorio,
                            CapturistaRepositorio capturistas,
                            @Value("${app.actas.ruta:/datos/actas}") String rutaBase) {
        this.repositorio = repositorio;
        this.capturistas = capturistas;
        this.base = Path.of(rutaBase);
    }

    /**
     * Guarda o reemplaza la foto de una casilla.
     *
     * Comprueba que la casilla esté entre las secciones del capturista, igual
     * que la captura: un teléfono robado no debe poder subir fotos ajenas.
     */
    @Transactional
    public Map<String, Object> guardar(int idCasilla, int idEleccion, MultipartFile archivo,
                                       int idCapturista, int idDispositivo) {

        if (archivo == null || archivo.isEmpty()) {
            throw new DatosInvalidosExcepcion("La imagen llegó vacía.");
        }
        if (!capturistas.cubre(idCapturista, idCasilla)) {
            throw new DatosInvalidosExcepcion("CASILLA_NO_ASIGNADA",
                    "Esta casilla no está entre las que tienes asignadas.");
        }

        Map<String, Object> datos = repositorio.datos(idCasilla, idEleccion)
                .orElseThrow(() -> new NoEncontradoExcepcion("NO_ENCONTRADO",
                        "No existe la casilla " + idCasilla + " en la elección " + idEleccion));

        String nombre = nombre(datos);
        Path carpeta = base.resolve(String.valueOf(datos.get("anio")));
        Path destino = carpeta.resolve(nombre);
        Path temporal = carpeta.resolve(nombre + ".tmp");

        try {
            Files.createDirectories(carpeta);
            try (var entrada = archivo.getInputStream()) {
                Files.copy(entrada, temporal, StandardCopyOption.REPLACE_EXISTING);
            }
            Files.move(temporal, destino, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo guardar la imagen del acta", e);
        }

        long bytes = archivo.getSize();
        String ruta = datos.get("anio") + "/" + nombre;
        repositorio.guardar(idCasilla, idEleccion, ruta, (int) bytes, idCapturista, idDispositivo);

        return Map.of(
                "ruta", ruta,
                "bytes", bytes,
                "nombre", nombre);
    }

    @Transactional(readOnly = true)
    public Path archivo(int idCasilla, int idEleccion) {
        Map<String, Object> fila = repositorio.buscar(idCasilla, idEleccion)
                .orElseThrow(() -> new NoEncontradoExcepcion("NO_ENCONTRADO",
                        "Esa casilla no tiene foto del acta."));
        Path ruta = base.resolve(String.valueOf(fila.get("ruta")));
        if (!Files.exists(ruta)) {
            throw new NoEncontradoExcepcion("NO_ENCONTRADO",
                    "La foto está registrada pero el archivo no está en el servidor.");
        }
        return ruta;
    }

    @Transactional(readOnly = true)
    public boolean tiene(int idCasilla, int idEleccion) {
        return repositorio.buscar(idCasilla, idEleccion).isPresent();
    }

    /**
     * 2027-GOB-040-1258-B.jpg
     *
     * Todo se normaliza a mayúsculas sin acentos ni espacios: el nombre va a
     * vivir en un sistema de archivos, no en una pantalla.
     */
    private String nombre(Map<String, Object> d) {
        return String.join("-",
                limpiar(d.get("anio")),
                limpiar(d.get("eleccion")),
                limpiar(d.get("municipio")),
                limpiar(d.get("seccion")),
                limpiar(d.get("tipo")))
                + ".jpg";
    }

    private String limpiar(Object valor) {
        if (valor == null) return "X";
        String texto = Normalizer.normalize(valor.toString(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toUpperCase()
                .replaceAll("[^A-Z0-9]+", "");
        return texto.isEmpty() ? "X" : texto;
    }
}
