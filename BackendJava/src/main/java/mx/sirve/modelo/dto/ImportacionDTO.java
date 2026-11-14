package mx.sirve.modelo.dto;

import java.util.List;

/**
 * Importación de capturistas desde un archivo.
 *
 * Cada fila es una persona con sus secciones, tal como vienen del CSV. Aquí
 * las secciones siguen siendo texto: convertirlas a identificadores es trabajo
 * del servicio, que es quien conoce el proceso y puede avisar de las que no
 * existen.
 */
public record ImportacionDTO(List<Fila> filas) {

    public record Fila(String nombre, String telefono, List<String> secciones) {
    }

    /**
     * Lo que se creó, y lo que no se pudo.
     *
     * Los errores no cancelan la importación entera: una fila mala no debe
     * impedir que entren las otras 299. Se informa renglón por renglón.
     */
    public record Resultado(int creados, int secciones, int compartidas, List<String> errores) {
    }
}