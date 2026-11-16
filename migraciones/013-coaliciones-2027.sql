-- =====================================================================
-- SIRVE-P · Coaliciones del proceso 2027
-- ---------------------------------------------------------------------
-- Las boletas de 2027 tienen cinco coaliciones, pero en el catálogo no
-- existen: las veinte opciones apuntan a coaliciones del proceso 2024, que se
-- reutilizaron al cargar los datos.
--
-- Eso funciona para contar votos, pero hace imposible administrarlas: no
-- aparecen en ninguna lista y su nombre, color y logo dependen de otro proceso.
--
-- Este script:
--   1. agrega color y logo a la tabla de coaliciones, como los partidos
--   2. crea las cinco coaliciones de 2027
--   3. reapunta las opciones de boleta a la coalición de su propio proceso
--   4. registra los partidos que integran cada una
--
-- Ejecutar como postgres, en la base SIRVE.
-- =====================================================================

BEGIN;

-- 1) Color y logo, igual que en los partidos.
ALTER TABLE sirve.coalicion
    ADD COLUMN IF NOT EXISTS color text,
    ADD COLUMN IF NOT EXISTS logo bytea,
    ADD COLUMN IF NOT EXISTS logo_tipo text;

ALTER TABLE sirve.coalicion DROP CONSTRAINT IF EXISTS coalicion_color_check;
ALTER TABLE sirve.coalicion
    ADD CONSTRAINT coalicion_color_check
    CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$');

-- 2) Las coaliciones de 2027, con el color que ya tienen sus opciones.
INSERT INTO sirve.coalicion (id_proceso, clave, nombre, activa, color)
SELECT 3, v.clave, v.clave, true, v.color
  FROM (VALUES
    ('C_PAN_PRI_PRD', '#1A237E'),
    ('C_PAN_PRI',     '#283593'),
    ('C_PAN_PRD',     '#3949AB'),
    ('C_PRI_PRD',     '#8E1B1B'),
    ('C_PVEM_MORENA', '#1B5E20')
  ) AS v(clave, color)
 WHERE NOT EXISTS (
        SELECT 1 FROM sirve.coalicion c WHERE c.id_proceso = 3 AND c.clave = v.clave);

-- 3) Reapuntar las opciones de boleta de 2027 a la coalición de su proceso.
-- La tabla destino no se puede referenciar dentro del JOIN del FROM: hay que
-- llevarla a la condición. Las coaliciones del catálogo se llaman igual que la
-- etiqueta de la boleta, así que el cruce es directo.
UPDATE sirve.opcion_boleta o
   SET id_coalicion = nueva.id
  FROM sirve.coalicion nueva
 WHERE nueva.id_proceso = 3
   AND nueva.clave = o.etiqueta
   AND o.tipo = 'COALICION'
   AND o.id_coalicion IS DISTINCT FROM nueva.id
   AND EXISTS (SELECT 1
                 FROM sirve.eleccion e
                 JOIN sirve.proceso_electoral p
                   ON p.id = e.id_proceso AND p.anio = 2027
                WHERE e.id = o.id_eleccion);

-- 4) Integrantes, deducidos de la clave: C_PAN_PRI_PRD son PAN, PRI y PRD.
INSERT INTO sirve.coalicion_partido (id_coalicion, id_partido)
SELECT c.id, p.id
  FROM sirve.coalicion c
  JOIN sirve.proceso_electoral pe ON pe.id = c.id_proceso AND pe.anio = 2027
  -- Se quita el prefijo C_ y se separa por guiones bajos: C_PAN_PRI_PRD
  -- queda en {PAN, PRI, PRD}. Comparar con LIKE exigía escapar el guion y
  -- cualquier error de escape dejaba la lista de integrantes vacía.
  JOIN sirve.partido p
    ON p.clave = ANY (string_to_array(regexp_replace(c.clave, '^C_', ''), '_'))
 WHERE NOT EXISTS (
        SELECT 1 FROM sirve.coalicion_partido x
         WHERE x.id_coalicion = c.id AND x.id_partido = p.id)
ON CONFLICT DO NOTHING;

-- 5) El color de la coalición, al de sus opciones si ya tenían uno.
UPDATE sirve.coalicion c
   SET color = o.color
  FROM (SELECT id_coalicion, min(color) AS color
          FROM sirve.opcion_boleta
         WHERE tipo = 'COALICION' AND color IS NOT NULL
         GROUP BY id_coalicion) o
 WHERE o.id_coalicion = c.id AND c.color IS NULL;

COMMIT;

-- ---------------------------------------------------------------------
-- Comprobación
-- ---------------------------------------------------------------------
SELECT c.id, c.clave, c.color,
       string_agg(p.clave, '+' ORDER BY p.clave) AS integrantes
  FROM sirve.coalicion c
  LEFT JOIN sirve.coalicion_partido cp ON cp.id_coalicion = c.id
  LEFT JOIN sirve.partido p ON p.id = cp.id_partido
 WHERE c.id_proceso = 3
 GROUP BY c.id, c.clave, c.color ORDER BY c.clave;

SELECT count(*) AS opciones_de_coalicion_2027
  FROM sirve.opcion_boleta o
  JOIN sirve.eleccion e ON e.id = o.id_eleccion
  JOIN sirve.proceso_electoral pr ON pr.id = e.id_proceso AND pr.anio = 2027
  JOIN sirve.coalicion c ON c.id = o.id_coalicion AND c.id_proceso = 3
 WHERE o.tipo = 'COALICION';
