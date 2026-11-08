-- =====================================================================
-- SIRVE-P · Procesos electorales
-- ---------------------------------------------------------------------
-- Qué hace:
--   1. Agrega id_entidad a proceso_electoral (antes se asumía un estado).
--   2. Cambia la regla de "un solo proceso activo" por "uno por entidad".
--   3. Carga los procesos de Nuevo León: 2021, 2024 y 2027.
--
-- Por qué se toca ux_proceso_activo:
--   El índice actual es UNIQUE (activo) WHERE activo, es decir, permite un
--   único proceso activo en TODA la base. Con tres procesos (2021, 2024 y
--   2027) y varios estados, eso es imposible. Se reemplaza por uno por
--   entidad: cada estado tiene su proceso vigente.
--
-- Requiere: 01-entidades.sql
-- Reejecutable.
-- =====================================================================

SET client_min_messages = warning;

-- 1. El proceso pertenece a una entidad ---------------------------------
ALTER TABLE sirve.proceso_electoral ADD COLUMN IF NOT EXISTS id_entidad integer;

UPDATE sirve.proceso_electoral
   SET id_entidad = (SELECT id FROM sirve.entidad WHERE clave = '19')
 WHERE id_entidad IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conname = 'fk_proceso_entidad'
                      AND conrelid = 'sirve.proceso_electoral'::regclass) THEN
        ALTER TABLE sirve.proceso_electoral
            ADD CONSTRAINT fk_proceso_entidad
            FOREIGN KEY (id_entidad) REFERENCES sirve.entidad (id);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_proceso_entidad_anio
    ON sirve.proceso_electoral (id_entidad, anio);

-- 1b. La fecha de la jornada puede no conocerse todavía (2027).
ALTER TABLE sirve.proceso_electoral ALTER COLUMN fecha_jornada DROP NOT NULL;

-- 2. Un proceso activo por entidad, no uno en toda la base --------------
DROP INDEX IF EXISTS sirve.ux_proceso_activo;

CREATE UNIQUE INDEX IF NOT EXISTS ux_proceso_activo_entidad
    ON sirve.proceso_electoral (id_entidad) WHERE activo;

COMMENT ON COLUMN sirve.proceso_electoral.activo IS
    'Proceso vigente de la entidad: solo uno puede estar activo por estado.';

-- 3. Los tres procesos de Nuevo León ------------------------------------
--    2021 y 2024 quedan cerrados; 2027 es el vigente y aún sin fecha.
INSERT INTO sirve.proceso_electoral (id_entidad, nombre, anio, fecha_jornada, estado, activo)
SELECT e.id, v.nombre, v.anio, v.jornada::date, v.estado::sirve.estado_proceso, v.activo
  FROM (VALUES
        ('Proceso Electoral 2021', 2021, '2021-06-06', 'CERRADO',    false),
        ('Proceso Electoral 2024', 2024, '2024-06-02', 'CERRADO',    false),
        ('Proceso Electoral 2027', 2027, NULL,         'PLANEACION', true)
       ) AS v(nombre, anio, jornada, estado, activo)
  JOIN sirve.entidad e ON e.clave = '19'
 WHERE NOT EXISTS (SELECT 1 FROM sirve.proceso_electoral p
                    WHERE p.id_entidad = e.id AND p.anio = v.anio);

-- 4. Comprobación
SELECT p.id, p.anio, p.nombre, p.estado, p.activo, p.fecha_jornada,
       e.clave AS entidad
  FROM sirve.proceso_electoral p
  JOIN sirve.entidad e ON e.id = p.id_entidad
 ORDER BY p.anio;
