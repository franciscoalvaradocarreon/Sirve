package mx.sirve.modelo.dto;

import java.util.List;

/** Lo que recibe el navegador al entrar: el token y con qué menús. */
public record RespuestaLogin(
        String token,
        UsuarioDTO usuario,
        List<MenuDTO> menus) {
}