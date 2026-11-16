package mx.sirve.servicio;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Correo saliente para los avisos.
 *
 * Usa la misma cuenta que el SIH —un Gmail con contraseña de aplicación—, así
 * que no hay nada nuevo que contratar. Las credenciales van en variables de
 * entorno, nunca en el repositorio.
 *
 * Si el correo no está configurado, el servicio lo dice y devuelve falso: el
 * aviso que lo usaba sigue por el otro canal. Un sistema de alertas que se cae
 * porque el correo no está puesto es peor que no tener alertas.
 */
@Service
public class CorreoServicio {

    private static final Logger log = LoggerFactory.getLogger(CorreoServicio.class);

    /*
     * Se pide como proveedor y no como dependencia directa: sin servidor de
     * correo configurado —en desarrollo, o antes de poner las credenciales—
     * Spring no crea el bean, y exigirlo impediría arrancar la aplicación.
     */
    private final ObjectProvider<JavaMailSender> proveedor;

    @Value("${spring.mail.username:}")
    private String remitente;

    @Value("${app.alertas.nombre:SIRVE-P}")
    private String nombre;

    public CorreoServicio(ObjectProvider<JavaMailSender> proveedor) {
        this.proveedor = proveedor;
    }

    /** Si hay cuenta y servidor configurados para enviar. */
    public boolean configurado() {
        return remitente != null && !remitente.isBlank() && proveedor.getIfAvailable() != null;
    }

    /**
     * Envía un aviso.
     *
     * @param destinatarios lista separada por comas
     * @return cierto si el servidor lo aceptó
     */
    public boolean enviar(String destinatarios, String asunto, String texto) {
        if (!configurado()) {
            log.warn("Sin cuenta de correo configurada; no se envía «{}».", asunto);
            return false;
        }
        if (destinatarios == null || destinatarios.isBlank()) {
            log.warn("Sin destinatarios configurados; no se envía «{}».", asunto);
            return false;
        }

        try {
            SimpleMailMessage mensaje = new SimpleMailMessage();
            // El remitente lleva el nombre del sistema: los avisos del SIH y los
            // de SIRVE salen de la misma cuenta, y así se distingue cuál es cuál.
            mensaje.setFrom(nombre + " <" + remitente + ">");
            mensaje.setTo(destinatarios.split("\\s*,\\s*"));
            mensaje.setSubject("[" + nombre + "] " + asunto);
            mensaje.setText(texto);

            proveedor.getIfAvailable().send(mensaje);
            log.info("Aviso enviado a {}: {}", destinatarios, asunto);
            return true;
        } catch (Exception e) {
            log.warn("No se pudo enviar el correo: {}", e.getMessage());
            return false;
        }
    }
}
