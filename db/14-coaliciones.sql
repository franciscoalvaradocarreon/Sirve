-- =====================================================================
-- SIRVE-P · Coaliciones (17)
-- ---------------------------------------------------------------------
-- Por proceso: 2021 y 2024 no comparten coaliciones.
--
-- Reejecutable.
-- =====================================================================

SET client_min_messages = warning;

INSERT INTO sirve.coalicion (id_proceso, clave, nombre, activa)
SELECT p.id, v.clave, v.clave, true
  FROM (VALUES
        (2021, 'C_MORENA_PANAL'),
        (2021, 'C_PRI_PRD'),
        (2021, 'C_PT_MORENA'),
        (2021, 'C_PT_MORENA_PANAL'),
        (2021, 'C_PT_PANAL'),
        (2021, 'C_PVEM_MORENA'),
        (2021, 'C_PVEM_MORENA_PANAL'),
        (2021, 'C_PVEM_PANAL'),
        (2021, 'C_PVEM_PT'),
        (2021, 'C_PVEM_PT_MORENA'),
        (2021, 'C_PVEM_PT_MORENA_PANAL'),
        (2021, 'C_PVEM_PT_PANAL'),
        (2024, 'C_PAN_PRD'),
        (2024, 'C_PAN_PRI'),
        (2024, 'C_PAN_PRI_PRD'),
        (2024, 'C_PRI_PRD'),
        (2024, 'C_PVEM_MORENA')
       ) AS v(anio, clave)
  JOIN sirve.entidad e ON e.clave = '19'
  JOIN sirve.proceso_electoral p ON p.id_entidad = e.id AND p.anio = v.anio
 WHERE NOT EXISTS (SELECT 1 FROM sirve.coalicion c
                    WHERE c.id_proceso = p.id AND c.clave = v.clave);

SELECT p.anio, count(*) AS coaliciones
  FROM sirve.coalicion c
  JOIN sirve.proceso_electoral p ON p.id = c.id_proceso
 GROUP BY p.anio ORDER BY p.anio;
