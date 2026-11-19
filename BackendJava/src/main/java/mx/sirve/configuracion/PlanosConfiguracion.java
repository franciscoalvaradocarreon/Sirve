package mx.sirve.configuracion;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Los planos de sección se sirven como archivos, no como datos de la aplicación.
 *
 * Son tres mil SVG de cartografía, y viajan con el despliegue en una carpeta del
 * servidor en lugar de dentro de la imagen: pesan más que el resto del sistema
 * junto y no cambian con cada liberación.
 *
 * Se buscan en este orden, y se usa la primera carpeta que exista:
 *
 *   1. la ruta configurada —en producción, /datos/planos, el montaje del servidor—
 *   2. «planos» junto al directorio de trabajo, y dos niveles arriba
 *
 * El segundo caso es para desarrollo: en el equipo de trabajo los planos viven
 * en la carpeta del proyecto y no hace falta configurar ninguna variable.
 *
 * Se cachean por una semana: un plano de sección no cambia salvo que se actualice
 * la cartografía a mano.
 */
@Configuration
public class PlanosConfiguracion implements WebMvcConfigurer {

    private static final Logger registro = LoggerFactory.getLogger(PlanosConfiguracion.class);

    private final Path base;

    public PlanosConfiguracion(@Value("${app.planos.ruta:/datos/planos}") String ruta) {
        this.base = resolver(ruta);
        registro.info("Planos de sección en {}", base);
    }

    private static Path resolver(String configurada) {
        Path principal = Path.of(configurada).toAbsolutePath().normalize();
        if (Files.isDirectory(principal)) {
            return principal;
        }

        for (String candidata : List.of("planos", "../planos", "../../planos")) {
            Path alternativa = Path.of(candidata).toAbsolutePath().normalize();
            if (Files.isDirectory(alternativa)) {
                return alternativa;
            }
        }
        return principal;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registro) {
        registro.addResourceHandler("/planos/**")
                .addResourceLocations(base.toUri().toString())
                .setCacheControl(CacheControl.maxAge(7, TimeUnit.DAYS).cachePublic());
    }
}
