package mx.sirve.excepcion;

/**
 * Se lanza cuando se pide un recurso que no existe.
 *
 * El manejador la convierte en un 404 con el formato de error del contrato,
 * en lugar de dejar que Spring devuelva su página blanca.
 */
public class NoEncontradoExcepcion extends RuntimeException {

    private final String codigo;

    public NoEncontradoExcepcion(String codigo, String mensaje) {
        super(mensaje);
        this.codigo = codigo;
    }

    public String getCodigo() {
        return codigo;
    }
}
