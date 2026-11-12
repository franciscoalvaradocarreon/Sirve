-- =====================================================================
-- SIRVE-P · El proceso es el año, no el ámbito
-- ---------------------------------------------------------------------
-- Un proceso electoral puede contener elecciones locales y federales.
-- El nombre «Proceso Electoral Local 2024» indujo a confusión: parecía
-- que el distrito federal no cabía ahí.
--
-- Este script solo renombra. No mueve datos ni toca secciones.
--
-- Reejecutable.
-- =====================================================================

SET client_min_messages = warning;

UPDATE sirve.proceso_electoral
   SET nombre = replace(nombre, 'Proceso Electoral Local', 'Proceso Electoral')
 WHERE nombre LIKE 'Proceso Electoral Local%';

COMMENT ON TABLE sirve.proceso_electoral IS
    'Ciclo electoral de una entidad en un año. Dentro caben elecciones locales y federales.';

SELECT id, anio, nombre, estado, activo
  FROM sirve.proceso_electoral
 ORDER BY anio;
