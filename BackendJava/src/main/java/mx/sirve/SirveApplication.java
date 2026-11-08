package mx.sirve;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Punto de entrada de SIRVE-P.
 *
 * La aplicación es un WAR que también corre solo (Tomcat embebido) y lleva
 * el front de React dentro de classpath:/static, igual que el SIH. Un solo
 * contenedor, un solo origen, sin CORS que coordinar en producción.
 */
@SpringBootApplication
public class SirveApplication {

    public static void main(String[] args) {
        SpringApplication.run(SirveApplication.class, args);
    }
}
