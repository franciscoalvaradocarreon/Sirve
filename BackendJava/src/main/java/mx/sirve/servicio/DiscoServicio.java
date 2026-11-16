package mx.sirve.servicio;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.FileStore;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Vigila el espacio en disco.
 *
 * Si el disco se llena, PostgreSQL deja de escribir y la captura se detiene sin
 * ningún mensaje en pantalla: los capturistas ven que «no guarda» y nadie sabe
 * por qué. Por eso conviene enterarse antes, no después.
 *
 * Revisa cada cinco minutos el disco donde viven las actas —el mismo donde está
 * la base— y avisa por webhook cuando pasa del umbral. El aviso se repite cada
 * seis horas como mucho: uno cada cinco minutos se vuelve ruido y se ignora.
 */
@Service
public class DiscoServicio {

    private static final Logger log = LoggerFactory.getLogger(DiscoServicio.class);

    /** Cada cuánto se repite el aviso mientras el disco siga lleno. */
    private static final Duration ESPERA_ENTRE_AVISOS = Duration.ofHours(6);

    private final ParametrosServicio parametros;
    private final CorreoServicio correo;

    @Value("${app.actas.ruta:/datos/actas}")
    private String rutaActas;

    private OffsetDateTime ultimoAviso = OffsetDateTime.MIN;
    private Map<String, Object> ultimoEstado = Map.of();

    public DiscoServicio(ParametrosServicio parametros, CorreoServicio correo) {
        this.parametros = parametros;
        this.correo = correo;
    }

    /** Estado del disco: lo que se muestra en pantalla y lo que se vigila. */
    public Map<String, Object> estado() {
        Map<String, Object> datos = new LinkedHashMap<>(medir());
        datos.put("umbral", umbral());
        // La franja en pantalla es opcional: el aviso puede ir solo por correo.
        datos.put("avisoPantalla", parametros.booleano("disco.aviso.pantalla", false));
        datos.put("aviso", (boolean) datos.getOrDefault("alerta", false)
                ? "El disco está por llenarse. Libera espacio o amplía el volumen."
                : null);
        return datos;
    }

    /**
     * Revisión periódica.
     *
     * Cada cinco minutos alcanza: el disco no se llena en un minuto, y una
     * revisión más seguida solo gasta recursos.
     */
    @Scheduled(fixedDelayString = "PT5M", initialDelayString = "PT1M")
    public void revisar() {
        Map<String, Object> datos = medir();
        ultimoEstado = datos;

        if (!(boolean) datos.get("alerta")) return;

        log.warn("Disco al {} % ({} libres de {})",
                datos.get("porcentaje"), datos.get("libreLegible"), datos.get("totalLegible"));

        OffsetDateTime ahora = OffsetDateTime.now();
        if (ultimoAviso.plus(ESPERA_ENTRE_AVISOS).isAfter(ahora)) return;

        if (enviarAviso(datos)) ultimoAviso = ahora;
    }

    /** Mide el disco donde vive la carpeta de actas. */
    private Map<String, Object> medir() {
        Map<String, Object> datos = new LinkedHashMap<>();
        try {
            Path ruta = Path.of(rutaActas);
            // Si la carpeta aún no existe, se mide la raíz.
            FileStore disco = Files.getFileStore(Files.exists(ruta) ? ruta : Path.of("/"));

            long total = disco.getTotalSpace();
            long libre = disco.getUsableSpace();
            long usado = total - libre;
            int porcentaje = total == 0 ? 0 : (int) Math.round(usado * 100.0 / total);

            datos.put("total", total);
            datos.put("libre", libre);
            datos.put("usado", usado);
            datos.put("porcentaje", porcentaje);
            datos.put("totalLegible", legible(total));
            datos.put("libreLegible", legible(libre));
            datos.put("alerta", porcentaje >= umbral());
        } catch (IOException e) {
            log.warn("No se pudo medir el disco: {}", e.getMessage());
            datos.put("error", "No se pudo medir el disco");
            datos.put("alerta", false);
        }
        return datos;
    }

    private int umbral() {
        return parametros.entero("disco.umbral", 80);
    }

    /**
     * Manda el aviso al webhook configurado.
     *
     * Sirve para cualquier servicio que reciba un POST con JSON: un bot de
     * Telegram, un canal de Slack, o un script propio. Si no hay webhook
     * configurado, solo queda el registro del servidor.
     */
    private boolean enviarAviso(Map<String, Object> datos) {
        String texto = "SIRVE-P · disco al %s %% (%s libres de %s)."
                .formatted(datos.get("porcentaje"), datos.get("libreLegible"), datos.get("totalLegible"));

        // Dos canales: el correo queda como registro y el webhook como urgencia.
        // Basta con que uno funcione para dar el aviso por enviado.
        boolean enviado = correo.enviar(
                parametros.texto("alerta.correo", ""),
                "Disco al " + datos.get("porcentaje") + " %",
                texto + "\n\nSi el disco se llena, la base deja de escribir y la captura se detiene.\n");

        String webhook = parametros.texto("alerta.webhook", "").trim();
        if (webhook.isEmpty()) {
            if (!enviado) {
                log.warn("Disco lleno y sin webhook ni correo configurado: revisa Parámetros.");
            }
            return enviado;
        }

        try {
            // Telegram espera {"chat_id": "...", "text": "..."}; un webhook
            // genérico acepta {"text": "..."}. Se manda el chat_id si está
            // configurado y el servicio lo ignora si no lo necesita.
            String chat = parametros.texto("alerta.chat", "").trim();
            String cuerpo = chat.isEmpty()
                    ? "{\"text\":\"" + escapar(texto) + "\"}"
                    : "{\"chat_id\":\"" + escapar(chat) + "\",\"text\":\"" + escapar(texto) + "\"}";

            HttpRequest peticion = HttpRequest.newBuilder(URI.create(webhook))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(cuerpo))
                    .build();

            HttpResponse<String> respuesta = HttpClient.newHttpClient()
                    .send(peticion, HttpResponse.BodyHandlers.ofString());

            if (respuesta.statusCode() / 100 == 2) {
                log.info("Aviso de disco enviado por webhook ({}).", respuesta.statusCode());
                return true;
            }
            log.warn("El webhook respondió {}: {}", respuesta.statusCode(), respuesta.body());
        } catch (Exception e) {
            log.warn("No se pudo enviar el aviso por webhook: {}", e.getMessage());
        }
        return enviado;
    }

    private String escapar(String texto) {
        return texto.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ");
    }

    private String legible(long bytes) {
        String[] unidades = {"B", "KB", "MB", "GB", "TB"};
        double valor = bytes;
        int i = 0;
        while (valor >= 1024 && i < unidades.length - 1) {
            valor /= 1024;
            i++;
        }
        return (valor >= 10 || i == 0 ? String.format("%.0f", valor) : String.format("%.1f", valor))
                + " " + unidades[i];
    }
}
