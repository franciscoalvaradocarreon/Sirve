package mx.sirve.excepcion;

/**
 * El cuerpo de la petición no cumple una regla de negocio.
 *
 * Se traduce a 400 con el código del contrato (VALIDACION u otro) para
 * distinguirlo de un fallo del servidor.
 */
public class DatosInvalidosExcepcion extends RuntimeException {

    private final String codigo;

    public DatosInvalidosExcepcion(String codigo, String mensaje) {
        super(mensaje);
        this.codigo = codigo;
    }

    public DatosInvalidosExcepcion(String mensaje) {
        this("VALIDACION", mensaje);
    }

    public String getCodigo() {
        return codigo;
    }
}
