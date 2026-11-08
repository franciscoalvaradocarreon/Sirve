package mx.sirve.configuracion;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS solo para desarrollo.
 *
 * En producción el front va dentro del WAR y se sirve del mismo origen, así
 * que no hay preflight que atender. En desarrollo, Vite corre en otro puerto
 * y el navegador lo bloquea sin esta configuración.
 */
@Configuration
public class CorsConfiguracion implements WebMvcConfigurer {

    private final String origenes;

    public CorsConfiguracion(@Value("${app.cors.origenes:http://localhost:5173}") String origenes) {
        this.origenes = origenes;
    }

    @Override
    public void addCorsMappings(CorsRegistry registro) {
        registro.addMapping("/api/**")
                .allowedOrigins(origenes.split(","))
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*");
    }
}
