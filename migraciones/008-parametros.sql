-- =====================================================================
-- SIRVE-P · Parámetros de la aplicación
-- ---------------------------------------------------------------------
-- Un lugar donde guardar los ajustes que cambian sin desplegar: encender la
-- sala de resultados, el plazo de los códigos de enrolamiento, los límites de
-- peticiones.
--
-- Antes vivían en variables de entorno, y cambiarlas obligaba a entrar al
-- servidor y reiniciar el contenedor. Para apagar la sala a media jornada eso
-- es demasiado.
--
-- Ejecutar como postgres (o el dueño del esquema), en la base SIRVE.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sirve.parametro (
    clave          varchar(60) PRIMARY KEY,
    valor          text        NOT NULL,
    descripcion    text,
    actualizado_en timestamptz NOT NULL DEFAULT now()
);

INSERT INTO sirve.parametro (clave, valor, descripcion) VALUES
    ('sala.habilitada', 'false',
     'Publica los resultados en /sala. Apagada, la pantalla existe pero no muestra cifras.'),
    ('sala.mensaje', 'Los resultados se publicarán el día de la jornada.',
     'Texto que se muestra en la sala mientras está apagada.'),
    ('enrolamiento.horas', '3',
     'Cuántas horas vale un código de enrolamiento antes de caducar.'),
    ('limite.credencial', '600',
     'Peticiones por minuto y por sesión o teléfono.'),
    ('limite.anonima', '300',
     'Peticiones por minuto desde una IP sin credencial.'),
    ('limite.credenciales', '20',
     'Peticiones por minuto e IP en login y enrolamiento.')
ON CONFLICT (clave) DO NOTHING;

-- Entrada de menú para administrarlos.
INSERT INTO sirve.menu (clave, etiqueta, ruta, icono, orden)
VALUES ('parametros', 'Parámetros', '/parametros', 'Settings', 43)
ON CONFLICT (clave) DO NOTHING;

UPDATE sirve.menu
   SET id_padre = (SELECT id FROM sirve.menu WHERE clave = 'operacion')
 WHERE clave = 'parametros';

-- Solo el Administrador: aquí se enciende lo que ve todo el mundo.
INSERT INTO sirve.rol_menu (rol, id_menu)
SELECT 'ADMIN'::sirve.rol_usuario, id FROM sirve.menu WHERE clave = 'parametros'
ON CONFLICT DO NOTHING;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sirve_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON sirve.parametro TO "User_app", sirve_app;
    ELSE
        GRANT SELECT, INSERT, UPDATE, DELETE ON sirve.parametro TO "User_app";
    END IF;
END $$;

COMMIT;

-- Comprobación
SELECT clave, valor FROM sirve.parametro ORDER BY clave;
