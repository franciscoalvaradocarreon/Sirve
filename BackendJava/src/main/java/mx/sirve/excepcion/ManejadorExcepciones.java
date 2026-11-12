package mx.sirve.excepcion;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.dao.DataAccessException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Traduce excepciones al formato de error del contrato:
 *
 *     { "error": { "codigo": "...", "mensaje": "...", "detalle": "..." } }
 *
 * Sin esto, Spring devuelve su estructura por omisión (timestamp, path,
 * status) y el cliente tendría dos formatos que atender.
 */
@RestControllerAdvice
public class ManejadorExcepciones {

    private static final Logger registro = LoggerFactory.getLogger(ManejadorExcepciones.class);

    @ExceptionHandler(NoEncontradoExcepcion.class)
    public ResponseEntity<Map<String, Object>> noEncontrado(NoEncontradoExcepcion e) {
        return cuerpo(HttpStatus.NOT_FOUND, e.getCodigo(), e.getMessage(), null);
    }

    @ExceptionHandler(DatosInvalidosExcepcion.class)
    public ResponseEntity<Map<String, Object>> datosInvalidos(DatosInvalidosExcepcion e) {
        return cuerpo(HttpStatus.BAD_REQUEST, e.getCodigo(), e.getMessage(), null);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, Object>> faltaParametro(MissingServletRequestParameterException e) {
        return cuerpo(HttpStatus.BAD_REQUEST, "VALIDACION",
                "Falta el parámetro '" + e.getParameterName() + "'", null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> noValido(MethodArgumentNotValidException e) {
        String detalle = e.getBindingResult().getFieldErrors().stream()
                .map(err -> err.getField() + ": " + err.getDefaultMessage())
                .findFirst()
                .orElse(null);
        return cuerpo(HttpStatus.BAD_REQUEST, "VALIDACION", "Los datos enviados no son válidos", detalle);
    }

    /**
     * Ruta que no existe.
     *
     * Sin este manejador, el comodín de abajo la atrapa y responde 500: un
     * cliente que pide una ruta mal escrita recibe «error interno» en lugar
     * de «no existe», y se pierde una hora buscando en el lugar equivocado.
     */
    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
    public ResponseEntity<Map<String, Object>> rutaInexistente(Exception e) {
        return cuerpo(HttpStatus.NOT_FOUND, "NO_ENCONTRADO",
                "La ruta solicitada no existe", null);
    }

    /**
     * La base rechazó la operación por permisos.
     *
     * Ocurre cuando el rol de la aplicación no tiene GRANT sobre la tabla.
     * Sin este manejador salía un 500 genérico y había que ir al registro del
     * servidor para descubrir que era un permiso y no un fallo de la lógica.
     */
    /** El rol del usuario no alcanza esa operación: 403, no 400. */
    @ExceptionHandler(SinPermisoExcepcion.class)
    public ResponseEntity<Map<String, Object>> sinPermiso(SinPermisoExcepcion e) {
        return cuerpo(HttpStatus.FORBIDDEN, e.getCodigo(), e.getMessage(), null);
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<Map<String, Object>> errorDeBase(DataAccessException e) {
        String estado = estadoSql(e);
        if ("42501".equals(estado)) {
            return cuerpo(HttpStatus.FORBIDDEN, "PERMISO_DENEGADO",
                    "La base rechazó la escritura: al rol de la aplicación le falta permiso "
                            + "sobre la tabla. Revisa los GRANT.", null);
        }
        registro.error("Error de base de datos", e);
        return cuerpo(HttpStatus.INTERNAL_SERVER_ERROR, "ERROR_BASE",
                "La base de datos rechazó la operación", estado);
    }

    /** Saca el SQLState de la excepción de PostgreSQL, si la hay. */
    private String estadoSql(Throwable e) {
        Throwable causa = e;
        while (causa != null) {
            if (causa instanceof SQLException sql) {
                return sql.getSQLState();
            }
            causa = causa.getCause();
        }
        return null;
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> inesperado(Exception e) {
        registro.error("Fallo no previsto", e);
        return cuerpo(HttpStatus.INTERNAL_SERVER_ERROR, "ERROR_INTERNO",
                "Ocurrió un error al procesar la petición", null);
    }

    private ResponseEntity<Map<String, Object>> cuerpo(HttpStatus estado, String codigo,
                                                       String mensaje, String detalle) {
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("codigo", codigo);
        error.put("mensaje", mensaje);
        if (detalle != null) {
            error.put("detalle", detalle);
        }
        return ResponseEntity.status(estado).body(Map.of("error", error));
    }
}
