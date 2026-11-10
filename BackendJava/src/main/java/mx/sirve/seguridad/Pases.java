package mx.sirve.seguridad;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Códigos de enrolamiento y pases de dispositivo.
 *
 * Regla: lo que se guarda en la base es siempre el **hash**, nunca el valor.
 * El pase en claro solo existe en el teléfono del capturista. Si alguien copia
 * la base, con lo que hay ahí no puede suplantar a nadie.
 *
 * Para el código de enrolamiento se usan letras y números sin los que se
 * confunden al leerlos o dictarlos: sin I, O, 0 ni 1.
 */
public final class Pases {

    /** 32 caracteres, sin los ambiguos. */
    private static final char[] ALFABETO =
            "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();

    private static final SecureRandom AZAR = new SecureRandom();

    private Pases() {
    }

    /** Código legible de ocho caracteres, para imprimir en la hoja del capturista. */
    public static String nuevoCodigo() {
        StringBuilder sb = new StringBuilder(8);
        for (int i = 0; i < 8; i++) {
            sb.append(ALFABETO[AZAR.nextInt(ALFABETO.length)]);
        }
        return sb.toString();
    }

    /** Pase del dispositivo: 32 bytes al azar, en base64 sin relleno. */
    public static String nuevoPase() {
        byte[] bytes = new byte[32];
        AZAR.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** Hash con el que se compara en la base. */
    public static String hash(String valor) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] resumen = md.digest(valor.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(resumen.length * 2);
            for (byte b : resumen) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo calcular el hash", e);
        }
    }

    /**
     * Normaliza lo que teclea el capturista: mayúsculas y sin espacios.
     * El código se imprime con guion para leerlo mejor, pero se guarda sin él.
     */
    public static String normalizarCodigo(String codigo) {
        return codigo == null ? "" : codigo.replaceAll("[^A-Za-z0-9]", "").toUpperCase();
    }
}
