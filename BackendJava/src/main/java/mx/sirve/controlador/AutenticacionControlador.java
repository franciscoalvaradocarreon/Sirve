package mx.sirve.controlador;

import mx.sirve.modelo.dto.RespuestaLogin;
import mx.sirve.modelo.dto.SolicitudLogin;
import mx.sirve.seguridad.JwtServicio;
import mx.sirve.servicio.AutenticacionServicio;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Entrada y salida del escritorio. */
@RestController
@RequestMapping("/api/auth")
public class AutenticacionControlador {

    private final AutenticacionServicio servicio;

    public AutenticacionControlador(AutenticacionServicio servicio) {
        this.servicio = servicio;
    }

    @PostMapping("/login")
    public ResponseEntity<RespuestaLogin> entrar(@RequestBody SolicitudLogin solicitud) {
        return ResponseEntity.ok(servicio.entrar(solicitud.usuario(), solicitud.clave()));
    }

    /**
     * Cierra la sesión de verdad.
     *
     * No basta con que el navegador olvide el token: si alguien lo copió,
     * seguiría sirviendo. Esto sube el contador de sesiones del usuario y
     * todos sus tokens dejan de valer al instante.
     */
    @PostMapping("/salir")
    public ResponseEntity<Map<String, Boolean>> salir(
            @RequestAttribute(JwtServicio.ATRIBUTO_USUARIO) JwtServicio.DatosToken datos) {
        servicio.salir(datos.idUsuario());
        return ResponseEntity.ok(Map.of("ok", true));
    }
}