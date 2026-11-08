-- =====================================================================
-- SIRVE-P · Diputaciones federales 2024 · mayoría relativa
-- ---------------------------------------------------------------------
-- 1. Coaliciones que no existían en el catálogo local (3).
-- 2. La elección, dentro del proceso 2024.
-- 3. Sus 16 opciones de boleta, en el orden del acta.
--
-- Requiere 03, 09, 13 y 14.
-- Reejecutable.
-- =====================================================================

SET client_min_messages = warning;

-- 1. Coaliciones propias de la elección federal
INSERT INTO sirve.coalicion (id_proceso, clave, nombre, activa)
SELECT p.id, v.clave, v.clave, true
  FROM (VALUES
        ('PVEM_PT_MORENA'),
        ('PVEM_PT'),
        ('PT_MORENA')
       ) AS v(clave)
  JOIN sirve.entidad e ON e.clave = '19'
  JOIN sirve.proceso_electoral p ON p.id_entidad = e.id AND p.anio = 2024
 WHERE NOT EXISTS (SELECT 1 FROM sirve.coalicion c
                    WHERE c.id_proceso = p.id AND c.clave = v.clave);

-- 2. La elección
INSERT INTO sirve.eleccion (id_proceso, clave, nombre, tipo, orden, capturable, activa)
SELECT p.id, 'DIPFED', 'Diputaciones federales 2024', 'DIPUTACION_FEDERAL', 3, true, true
  FROM sirve.entidad e
  JOIN sirve.proceso_electoral p ON p.id_entidad = e.id AND p.anio = 2024
 WHERE e.clave = '19'
   AND NOT EXISTS (SELECT 1 FROM sirve.eleccion el
                    WHERE el.id_proceso = p.id AND el.clave = 'DIPFED');

-- 3. Opciones de boleta
INSERT INTO sirve.opcion_boleta (id_eleccion, tipo, id_partido, id_coalicion, etiqueta, orden, activo)
SELECT el.id, v.tipo::sirve.tipo_opcion, pa.id, co.id, v.etiqueta, v.orden, true
  FROM (VALUES
        ('PARTIDO',      'PAN', NULL, 1),
        ('PARTIDO',      'PRI', NULL, 2),
        ('PARTIDO',      'PRD', NULL, 3),
        ('PARTIDO',      'PVEM', NULL, 4),
        ('PARTIDO',      'PT', NULL, 5),
        ('PARTIDO',      'MC', NULL, 6),
        ('PARTIDO',      'MORENA', NULL, 7),
        ('INDEPENDIENTE', 'CI',  NULL, 8),
        ('COALICION',     'C_PAN_PRI_PRD', NULL, 9),
        ('COALICION',     'C_PAN_PRI', NULL, 10),
        ('COALICION',     'C_PAN_PRD', NULL, 11),
        ('COALICION',     'C_PRI_PRD', NULL, 12),
        ('COALICION',     'PVEM_PT_MORENA', NULL, 13),
        ('COALICION',     'PVEM_PT', NULL, 14),
        ('COALICION',     'C_PVEM_MORENA', NULL, 15),
        ('COALICION',     'PT_MORENA', NULL, 16)
       ) AS v(tipo, etiqueta, ignorar, orden)
  JOIN sirve.entidad e ON e.clave = '19'
  JOIN sirve.proceso_electoral p ON p.id_entidad = e.id AND p.anio = 2024
  JOIN sirve.eleccion el ON el.id_proceso = p.id AND el.clave = 'DIPFED'
  LEFT JOIN sirve.partido  pa ON v.tipo = 'PARTIDO'   AND pa.clave = v.etiqueta
  LEFT JOIN sirve.coalicion co ON v.tipo = 'COALICION' AND co.id_proceso = p.id AND co.clave = v.etiqueta
 WHERE NOT EXISTS (SELECT 1 FROM sirve.opcion_boleta ob
                    WHERE ob.id_eleccion = el.id AND ob.orden = v.orden);

SELECT ob.orden, ob.tipo, ob.etiqueta
  FROM sirve.opcion_boleta ob
  JOIN sirve.eleccion el ON el.id = ob.id_eleccion
 WHERE el.clave = 'DIPFED'
 ORDER BY ob.orden;
