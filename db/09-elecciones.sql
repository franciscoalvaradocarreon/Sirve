-- =====================================================================
-- SIRVE-P · Elecciones por proceso
-- ---------------------------------------------------------------------
-- 2021: gobernatura, diputaciones locales y ayuntamientos.
-- 2024: diputaciones locales y ayuntamientos.
--
-- Requiere: 03-procesos.sql
-- Reejecutable.
-- =====================================================================

SET client_min_messages = warning;

INSERT INTO sirve.eleccion (id_proceso, clave, nombre, tipo, orden, capturable, activa)
SELECT p.id, v.clave, v.nombre, v.tipo::sirve.tipo_eleccion, v.orden, true, true
  FROM (VALUES
        (2021, 'GOB',   'Gobernatura 2021',            'GOBERNATURA',           1),
        (2021, 'DIP',   'Diputaciones locales 2021',   'DIPUTACION_LOCAL',      2),
        (2021, 'AYUNT', 'Ayuntamientos 2021',          'PRESIDENCIA_MUNICIPAL', 3),
        (2024, 'DIP',   'Diputaciones locales 2024',   'DIPUTACION_LOCAL',      1),
        (2024, 'AYUNT', 'Ayuntamientos 2024',          'PRESIDENCIA_MUNICIPAL', 2)
       ) AS v(anio, clave, nombre, tipo, orden)
  JOIN sirve.entidad e ON e.clave = '19'
  JOIN sirve.proceso_electoral p ON p.id_entidad = e.id AND p.anio = v.anio
 WHERE NOT EXISTS (SELECT 1 FROM sirve.eleccion el
                    WHERE el.id_proceso = p.id AND el.clave = v.clave);

SELECT p.anio, count(*) AS elecciones
  FROM sirve.eleccion el
  JOIN sirve.proceso_electoral p ON p.id = el.id_proceso
 GROUP BY p.anio ORDER BY p.anio;
