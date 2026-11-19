package mx.sirve.configuracion;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

/**
 * Los planos de sección se sirven como archivos, no como datos de la aplicación.
 *
 * Son tres mil SVG de cartografía, y viajan con el despliegue en una carpeta del
 * servidor en lugar de dentro de la imagen: pesan más que el resto del sistema
 * junto y no cambian con cada liberación.
 *
 * Se cachean por una semana: un plano de sección no cambia salvo que se actualice
 * la cartografía a mano.
 */
@Configuration
public class PlanosConfiguracion implements WebMvcConfigurer {

    private final String ruta;

    public PlanosConfiguracion(@Value("${app.planos.ruta:/datos/planos}") String ruta) {
        this.ruta = ruta;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registro) {
        Path base = Path.of(ruta).toAbsolutePath().normalize();

        registro.addResourceHandler("/planos/**")
                .addResourceLocations(base.toUri().toString())
                .setCacheControl(CacheControl.maxAge(7, TimeUnit.DAYS).cachePublic());
    }
}
