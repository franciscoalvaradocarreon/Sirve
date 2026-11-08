package mx.sirve.configuracion;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;

/**
 * Sirve la aplicación de React desde el mismo jar, incluidas sus rutas.
 *
 * El front usa enrutamiento del navegador, así que `/reportes/avance` no es un
 * archivo: es una ruta que React resuelve en el cliente. Sin este respaldo,
 * entrar directo o recargar esa dirección devolvía 404, porque Tomcat buscaba
 * un archivo con ese nombre.
 *
 * La regla: si el archivo pedido existe en `static/`, se entrega; si no, y no
 * es una ruta de la API ni del actuator, se entrega `index.html` y React se
 * encarga. Las rutas de la API se dejan pasar para que un endpoint
 * inexistente siga devolviendo 404 y no la página.
 */
@Configuration
public class SpaConfiguracion implements WebMvcConfigurer {

    private static final String[] RUTAS_DEL_SERVIDOR = {"api/", "actuator/"};

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registro) {
        registro.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String ruta, Resource ubicacion) throws IOException {
                        Resource pedido = ubicacion.createRelative(ruta);
                        if (pedido.exists() && pedido.isReadable()) {
                            return pedido;
                        }
                        for (String prefijo : RUTAS_DEL_SERVIDOR) {
                            if (ruta.startsWith(prefijo)) {
                                return null;
                            }
                        }
                        Resource indice = new ClassPathResource("static/index.html");
                        return indice.exists() ? indice : null;
                    }
                });
    }
}
