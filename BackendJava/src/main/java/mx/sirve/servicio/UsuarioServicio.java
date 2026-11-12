package mx.sirve.servicio;

import mx.sirve.excepcion.DatosInvalidosExcepcion;
import mx.sirve.excepcion.NoEncontradoExcepcion;
import mx.sirve.modelo.dto.UsuarioDTO;
import mx.sirve.repositorio.UsuarioRepositorio;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;

/**
 * Alta y mantenimiento de usuarios del escritorio.
 *
 * La contraseña nunca se guarda ni se devuelve: se entrega una vez al crearla
 * y a partir de ahí solo existe el hash. Si alguien la olvida, se le asigna
 * otra; no hay forma de recuperar la anterior.
 */
@Service
public class UsuarioServicio {

    private static final String ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final String[] ROLES = {
            "ADMIN", "COORDINADOR", "OPERADOR", "ANALISTA", "AUDITOR"
    };

    private final UsuarioRepositorio usuarios;
    private final AutenticacionServicio autenticacion;
    private final BCryptPasswordEncoder codificador = new BCryptPasswordEncoder(12);

    public UsuarioServicio(UsuarioRepositorio usuarios, AutenticacionServicio autenticacion) {
        this.usuarios = usuarios;
        this.autenticacion = autenticacion;
    }

    public List<UsuarioDTO> listar() {
        return usuarios.listar();
    }

    @Transactional
    public String crear(String usuario, String nombre, String rol, String clave) {
        if (usuario == null || usuario.isBlank() || nombre == null || nombre.isBlank()) {
            throw new DatosInvalidosExcepcion("DATOS", "El usuario y el nombre son obligatorios.");
        }
        if (usuarios.porUsuario(usuario).isPresent()) {
            throw new DatosInvalidosExcepcion("USUARIO_EXISTE", "Ese usuario ya existe.");
        }

        String definitiva = (clave == null || clave.isBlank()) ? generarClave() : clave;
        validarClave(definitiva);
        usuarios.crear(usuario.trim(), nombre.trim(),
                autenticacion.hashear(definitiva), validarRol(rol), true);
        return definitiva;
    }

    @Transactional
    public void actualizar(String id, String nombre, String rol, boolean activo, String idSesion) {
        usuarios.porId(id).orElseThrow(() ->
                new NoEncontradoExcepcion("NO_ENCONTRADO", "Ese usuario no existe."));

        // Un administrador que se desactiva o se cambia el rol a sí mismo se
        // deja fuera y ya no puede volver a entrar a arreglarlo.
        if (id.equals(idSesion) && (!activo || !"ADMIN".equals(validarRol(rol)))) {
            throw new DatosInvalidosExcepcion("PROPIO_USUARIO",
                    "No puedes quitarte el rol de administrador ni desactivarte a ti mismo.");
        }

        usuarios.actualizar(id, nombre.trim(), validarRol(rol), activo);
        if (!activo) usuarios.cerrarSesiones(id);
    }

    /** Devuelve la contraseña nueva, que se muestra una sola vez. */
    @Transactional
    public String restablecer(String id, String clave) {
        usuarios.porId(id).orElseThrow(() ->
                new NoEncontradoExcepcion("NO_ENCONTRADO", "Ese usuario no existe."));
        String definitiva = (clave == null || clave.isBlank()) ? generarClave() : clave;
        validarClave(definitiva);
        usuarios.cambiarClave(id, autenticacion.hashear(definitiva));
        return definitiva;
    }

    @Transactional
    public void cambiarPropia(String id, String claveActual, String claveNueva) {
        UsuarioDTO yo = usuarios.porId(id).orElseThrow(() ->
                new NoEncontradoExcepcion("NO_ENCONTRADO", "Ese usuario no existe."));
        validarClave(claveNueva);

        var cred = usuarios.credenciales(yo.usuario()).orElseThrow();
        if (!codificador.matches(claveActual, (String) cred.get("hash"))) {
            throw new DatosInvalidosExcepcion("CLAVE_INCORRECTA", "La contraseña actual no coincide.");
        }
        usuarios.cambiarClave(id, autenticacion.hashear(claveNueva));
    }

    @Transactional
    public void eliminar(String id, String idSesion) {
        if (id.equals(idSesion)) {
            throw new DatosInvalidosExcepcion("PROPIO_USUARIO", "No puedes eliminar tu propio usuario.");
        }
        usuarios.eliminar(id);
    }

    private String validarRol(String rol) {
        if (rol == null) throw new DatosInvalidosExcepcion("ROL", "Falta el rol.");
        for (String valido : ROLES) {
            if (valido.equals(rol)) return rol;
        }
        throw new DatosInvalidosExcepcion("ROL", "Ese rol no existe.");
    }

    private void validarClave(String clave) {
        if (clave == null || clave.length() < 8) {
            throw new DatosInvalidosExcepcion("CLAVE_CORTA",
                    "La contraseña debe tener al menos 8 caracteres.");
        }
    }

    /** Contraseña legible: sin caracteres que se confunden al dictarla. */
    public String generarClave() {
        SecureRandom azar = new SecureRandom();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 10; i++) sb.append(ALFABETO.charAt(azar.nextInt(ALFABETO.length())));
        return sb.toString();
    }
}
