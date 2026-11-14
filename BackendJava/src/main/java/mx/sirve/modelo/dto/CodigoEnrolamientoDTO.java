package mx.sirve.modelo.dto;

import java.time.OffsetDateTime;

/**
 * Código de enrolamiento recién generado, para imprimir, dictar o mandar.
 *
 * `expira` viene para que la pantalla pueda decir hasta cuándo sirve: un
 * código que caduca mañana y otro que caduca en un mes no se mandan igual.
 */
public record CodigoEnrolamientoDTO(
        Integer idDispositivo,
        String codigo,
        String nombre,
        OffsetDateTime expira) {
}