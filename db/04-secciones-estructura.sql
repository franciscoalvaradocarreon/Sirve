-- =====================================================================
-- SIRVE-P · Estructura de secciones por proceso
-- ---------------------------------------------------------------------
-- El catálogo de secciones cambia entre procesos: 2 782 en 2021 y 2 877
-- en 2024. La tabla actual tiene UNIQUE (id_municipio, clave), que impide
-- que una misma clave exista en dos procesos.
--
-- Qué hace:
--   1. Agrega id_proceso.
--   2. Sustituye la clave única por (id_proceso, id_municipio, clave).
--
-- Requiere: 03-procesos.sql (y que seccion esté vacía).
-- Reejecutable.
-- =====================================================================

SET client_min_messages = warning;

ALTER TABLE sirve.seccion ADD COLUMN IF NOT EXISTS id_proceso integer;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conname = 'fk_seccion_proceso'
                      AND conrelid = 'sirve.seccion'::regclass) THEN
        ALTER TABLE sirve.seccion
            ADD CONSTRAINT fk_seccion_proceso
            FOREIGN KEY (id_proceso) REFERENCES sirve.proceso_electoral (id);
    END IF;
END $$;

ALTER TABLE sirve.seccion ALTER COLUMN id_proceso SET NOT NULL;

-- La clave deja de ser única por municipio y pasa a serlo por proceso.
ALTER TABLE sirve.seccion DROP CONSTRAINT IF EXISTS seccion_id_municipio_clave_key;

CREATE UNIQUE INDEX IF NOT EXISTS ux_seccion_proceso_municipio_clave
    ON sirve.seccion (id_proceso, id_municipio, clave);

COMMENT ON COLUMN sirve.seccion.id_proceso IS
    'El catálogo de secciones es propio de cada proceso electoral.';
