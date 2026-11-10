-- =====================================================================
-- SIRVE-P · Permisos de las tablas nuevas
-- ---------------------------------------------------------------------
-- La migración creó las tablas como `postgres`, así que quedaron suyas y
-- los roles de la aplicación no pueden escribir en ellas.
--
-- Ejecutar como postgres, en la base SIRVE. Es reejecutable.
-- =====================================================================

BEGIN;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON sirve.capturista, sirve.dispositivo, sirve.capturista_seccion
    TO "User_app", sirve_app;

GRANT USAGE, SELECT
    ON SEQUENCE sirve.capturista_id_seq, sirve.dispositivo_id_seq
    TO "User_app", sirve_app;

-- La captura gana dos columnas; el permiso de tabla las cubre, pero se
-- repite por si la tabla cambió de dueño en el camino.
GRANT SELECT, INSERT, UPDATE, DELETE ON sirve.captura TO "User_app", sirve_app;

-- Para que no vuelva a pasar: lo que se cree en adelante en el esquema
-- sirve nace con permisos para los dos roles.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA sirve
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "User_app", sirve_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA sirve
    GRANT USAGE, SELECT ON SEQUENCES TO "User_app", sirve_app;

COMMIT;

-- Comprobación: las seis columnas deben salir en true
SELECT has_table_privilege('User_app',  'sirve.capturista',          'INSERT') AS user_app_capturista,
       has_table_privilege('sirve_app', 'sirve.capturista',          'INSERT') AS app_capturista,
       has_table_privilege('User_app',  'sirve.dispositivo',         'UPDATE') AS user_app_dispositivo,
       has_table_privilege('sirve_app', 'sirve.dispositivo',         'UPDATE') AS app_dispositivo,
       has_table_privilege('User_app',  'sirve.capturista_seccion',  'INSERT') AS user_app_seccion,
       has_table_privilege('sirve_app', 'sirve.capturista_seccion',  'INSERT') AS app_seccion;