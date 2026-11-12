package mx.sirve.excepcion;

/** El usuario está dentro, pero su rol no alcanza esta operación. */
public class SinPermisoExcepcion extends RuntimeException {

    private final String codigo;

    public SinPermisoExcepcion(String codigo, String mensaje) {
        super(mensaje);
        this.codigo = codigo;
    }

    public String getCodigo() {
        return codigo;
    }
}