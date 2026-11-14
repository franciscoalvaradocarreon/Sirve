package mx.sirve.servicio;

import mx.sirve.repositorio.ParametroRepositorio;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Lectura y escritura de parámetros.
 *
 * Si un parámetro no está en la base se usa el valor por omisión que recibe
 * quien pregunta. Así una tabla vacía no deja el sistema sin funcionar, y
 * agregar un parámetro nuevo no exige una migración para que arranque.
 */
@Service
public class ParametrosServicio {

    private static final Logger log = LoggerFactory.getLogger(ParametrosServicio.class);

    private final ParametroRepositorio repositorio;

    public ParametrosServicio(ParametroRepositorio repositorio) {
        this.repositorio = repositorio;
    }

    public List<ParametroRepositorio.Parametro> todos() {
        return repositorio.todos();
    }

    /** Valor de un parámetro, o el de omisión si no está o no se puede leer. */
    public String texto(String clave, String porOmision) {
        try {
            return repositorio.leer(clave).orElse(porOmision);
        } catch (Exception e) {
            log.warn("No se pudo leer el parámetro {}: {}", clave, e.getMessage());
            return porOmision;
        }
    }

    public boolean booleano(String clave, boolean porOmision) {
        return Boolean.parseBoolean(texto(clave, String.valueOf(porOmision)));
    }

    public int entero(String clave, int porOmision) {
        try {
            return Integer.parseInt(texto(clave, String.valueOf(porOmision)).trim());
        } catch (NumberFormatException e) {
            return porOmision;
        }
    }

    public void guardar(String clave, String valor) {
        repositorio.guardar(clave, valor);
    }

    /* Atajos con los nombres reales, para no repetir cadenas por el código. */

    public boolean salaHabilitada() {
        return booleano("sala.habilitada", false);
    }

    public String salaMensaje() {
        return texto("sala.mensaje", "Los resultados se publicarán el día de la jornada.");
    }

    public int horasEnrolamiento() {
        return entero("enrolamiento.horas", 3);
    }
}