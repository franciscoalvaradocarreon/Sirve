-- =====================================================================
-- SIRVE-P · Color en la opción de boleta (parte estructural de la 010)
-- ---------------------------------------------------------------------
-- La migración 010 hacía dos cosas: agregar la columna de color a la opción
-- de boleta y poner colores a los partidos. La segunda ya no conviene
-- repetirla: los colores del catálogo se han ajustado a mano y volver a
-- correrla los sobrescribiría.
--
-- Este script hace solo la parte estructural, y es seguro correrlo varias
-- veces: donde la columna ya existe no hace nada.
--
-- Ejecutar como postgres, en la base SIRVE.
-- =====================================================================

BEGIN;

ALTER TABLE sirve.opcion_boleta
    ADD COLUMN IF NOT EXISTS color text;

ALTER TABLE sirve.opcion_boleta
    DROP CONSTRAINT IF EXISTS opcion_boleta_color_check;

ALTER TABLE sirve.opcion_boleta
    ADD CONSTRAINT opcion_boleta_color_check
    CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$');

-- Los partidos toman el color de su catálogo, solo donde la opción no tenga uno.
UPDATE sirve.opcion_boleta o
   SET color = p.color
  FROM sirve.partido p
 WHERE o.id_partido = p.id
   AND p.color IS NOT NULL
   AND o.color IS NULL;

-- Las coaliciones, el de su propia ficha.
UPDATE sirve.opcion_boleta o
   SET color = c.color
  FROM sirve.coalicion c
 WHERE o.id_coalicion = c.id
   AND c.color IS NOT NULL
   AND o.color IS NULL;

-- Lo que quede sin color, un gris neutro: la gráfica no debe salir con huecos.
UPDATE sirve.opcion_boleta SET color = '#546E7A' WHERE color IS NULL;

COMMIT;

-- Comprobación
SELECT id_eleccion, count(*) AS opciones, count(color) AS con_color
  FROM sirve.opcion_boleta GROUP BY 1 ORDER BY 1;
