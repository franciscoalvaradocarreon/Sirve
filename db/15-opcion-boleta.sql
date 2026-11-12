-- =====================================================================
-- SIRVE-P · Opciones de boleta (107)
-- ---------------------------------------------------------------------
-- Qué recibe votos en cada elección, en el orden en que aparece en el acta.
-- Una coalición es una opción propia: sus votos no se reparten entre los
-- partidos que la forman.
--
-- Reejecutable.
-- =====================================================================

SET client_min_messages = warning;

INSERT INTO sirve.opcion_boleta (id_eleccion, tipo, id_partido, id_coalicion, etiqueta, orden, activo)
SELECT el.id,
       v.tipo::sirve.tipo_opcion,
       pa.id,
       co.id,
       v.etiqueta,
       v.orden,
       true
  FROM (VALUES
        (2021, 'GOB', 'PARTIDO', 'PAN', 1),
        (2021, 'GOB', 'PARTIDO', 'PRI', 2),
        (2021, 'GOB', 'PARTIDO', 'PRD', 3),
        (2021, 'GOB', 'PARTIDO', 'PVEM', 4),
        (2021, 'GOB', 'PARTIDO', 'PT', 5),
        (2021, 'GOB', 'PARTIDO', 'MC', 6),
        (2021, 'GOB', 'PARTIDO', 'MORENA', 7),
        (2021, 'GOB', 'PARTIDO', 'NANL', 8),
        (2021, 'GOB', 'PARTIDO', 'PES', 9),
        (2021, 'GOB', 'PARTIDO', 'RSP', 10),
        (2021, 'GOB', 'PARTIDO', 'FXM', 11),
        (2021, 'GOB', 'COALICION', 'C_PRI_PRD', 12),
        (2021, 'GOB', 'COALICION', 'C_PVEM_PT_MORENA_PANAL', 13),
        (2021, 'GOB', 'COALICION', 'C_PVEM_PT_MORENA', 14),
        (2021, 'GOB', 'COALICION', 'C_PVEM_PT_PANAL', 15),
        (2021, 'GOB', 'COALICION', 'C_PVEM_MORENA_PANAL', 16),
        (2021, 'GOB', 'COALICION', 'C_PT_MORENA_PANAL', 17),
        (2021, 'GOB', 'COALICION', 'C_PVEM_PT', 18),
        (2021, 'GOB', 'COALICION', 'C_PVEM_MORENA', 19),
        (2021, 'GOB', 'COALICION', 'C_PVEM_PANAL', 20),
        (2021, 'GOB', 'COALICION', 'C_PT_MORENA', 21),
        (2021, 'GOB', 'COALICION', 'C_PT_PANAL', 22),
        (2021, 'GOB', 'COALICION', 'C_MORENA_PANAL', 23),
        (2021, 'DIP', 'PARTIDO', 'PAN', 1),
        (2021, 'DIP', 'PARTIDO', 'PRI', 2),
        (2021, 'DIP', 'PARTIDO', 'PRD', 3),
        (2021, 'DIP', 'PARTIDO', 'PVEM', 4),
        (2021, 'DIP', 'PARTIDO', 'PT', 5),
        (2021, 'DIP', 'PARTIDO', 'MC', 6),
        (2021, 'DIP', 'PARTIDO', 'MORENA', 7),
        (2021, 'DIP', 'PARTIDO', 'NANL', 8),
        (2021, 'DIP', 'PARTIDO', 'PES', 9),
        (2021, 'DIP', 'PARTIDO', 'RSP', 10),
        (2021, 'DIP', 'PARTIDO', 'FXM', 11),
        (2021, 'DIP', 'COALICION', 'C_PRI_PRD', 12),
        (2021, 'DIP', 'COALICION', 'C_PVEM_PT_MORENA_PANAL', 13),
        (2021, 'DIP', 'COALICION', 'C_PVEM_PT_MORENA', 14),
        (2021, 'DIP', 'COALICION', 'C_PVEM_PT_PANAL', 15),
        (2021, 'DIP', 'COALICION', 'C_PVEM_MORENA_PANAL', 16),
        (2021, 'DIP', 'COALICION', 'C_PT_MORENA_PANAL', 17),
        (2021, 'DIP', 'COALICION', 'C_PVEM_PT', 18),
        (2021, 'DIP', 'COALICION', 'C_PVEM_MORENA', 19),
        (2021, 'DIP', 'COALICION', 'C_PVEM_PANAL', 20),
        (2021, 'DIP', 'COALICION', 'C_PT_MORENA', 21),
        (2021, 'DIP', 'COALICION', 'C_PT_PANAL', 22),
        (2021, 'DIP', 'COALICION', 'C_MORENA_PANAL', 23),
        (2021, 'DIP', 'INDEPENDIENTE', 'CI_1', 24),
        (2021, 'AYUNT', 'PARTIDO', 'PAN', 1),
        (2021, 'AYUNT', 'PARTIDO', 'PRI', 2),
        (2021, 'AYUNT', 'PARTIDO', 'PRD', 3),
        (2021, 'AYUNT', 'PARTIDO', 'PVEM', 4),
        (2021, 'AYUNT', 'PARTIDO', 'PT', 5),
        (2021, 'AYUNT', 'PARTIDO', 'MC', 6),
        (2021, 'AYUNT', 'PARTIDO', 'MORENA', 7),
        (2021, 'AYUNT', 'PARTIDO', 'NANL', 8),
        (2021, 'AYUNT', 'PARTIDO', 'PES', 9),
        (2021, 'AYUNT', 'PARTIDO', 'RSP', 10),
        (2021, 'AYUNT', 'PARTIDO', 'FXM', 11),
        (2021, 'AYUNT', 'COALICION', 'C_PRI_PRD', 12),
        (2021, 'AYUNT', 'COALICION', 'C_PVEM_PT_MORENA_PANAL', 13),
        (2021, 'AYUNT', 'COALICION', 'C_PVEM_PT_MORENA', 14),
        (2021, 'AYUNT', 'COALICION', 'C_PVEM_PT_PANAL', 15),
        (2021, 'AYUNT', 'COALICION', 'C_PVEM_MORENA_PANAL', 16),
        (2021, 'AYUNT', 'COALICION', 'C_PT_MORENA_PANAL', 17),
        (2021, 'AYUNT', 'COALICION', 'C_PVEM_PT', 18),
        (2021, 'AYUNT', 'COALICION', 'C_PVEM_MORENA', 19),
        (2021, 'AYUNT', 'COALICION', 'C_PVEM_PANAL', 20),
        (2021, 'AYUNT', 'COALICION', 'C_PT_MORENA', 21),
        (2021, 'AYUNT', 'COALICION', 'C_PT_PANAL', 22),
        (2021, 'AYUNT', 'COALICION', 'C_MORENA_PANAL', 23),
        (2021, 'AYUNT', 'INDEPENDIENTE', 'CI_1', 24),
        (2021, 'AYUNT', 'INDEPENDIENTE', 'CI_2', 25),
        (2024, 'DIP', 'PARTIDO', 'PAN', 1),
        (2024, 'DIP', 'PARTIDO', 'PRI', 2),
        (2024, 'DIP', 'PARTIDO', 'PRD', 3),
        (2024, 'DIP', 'PARTIDO', 'PVEM', 4),
        (2024, 'DIP', 'PARTIDO', 'PT', 5),
        (2024, 'DIP', 'PARTIDO', 'MC', 6),
        (2024, 'DIP', 'PARTIDO', 'MORENA', 7),
        (2024, 'DIP', 'PARTIDO', 'VIDA_NL', 8),
        (2024, 'DIP', 'PARTIDO', 'ESO', 9),
        (2024, 'DIP', 'PARTIDO', 'LIBERAL', 10),
        (2024, 'DIP', 'PARTIDO', 'PESNL', 11),
        (2024, 'DIP', 'PARTIDO', 'JUSTICIALISTA', 12),
        (2024, 'DIP', 'COALICION', 'C_PAN_PRI_PRD', 13),
        (2024, 'DIP', 'COALICION', 'C_PAN_PRI', 14),
        (2024, 'DIP', 'COALICION', 'C_PAN_PRD', 15),
        (2024, 'DIP', 'COALICION', 'C_PRI_PRD', 16),
        (2024, 'DIP', 'COALICION', 'C_PVEM_MORENA', 17),
        (2024, 'AYUNT', 'PARTIDO', 'PAN', 1),
        (2024, 'AYUNT', 'PARTIDO', 'PRI', 2),
        (2024, 'AYUNT', 'PARTIDO', 'PRD', 3),
        (2024, 'AYUNT', 'PARTIDO', 'PVEM', 4),
        (2024, 'AYUNT', 'PARTIDO', 'PT', 5),
        (2024, 'AYUNT', 'PARTIDO', 'MC', 6),
        (2024, 'AYUNT', 'PARTIDO', 'MORENA', 7),
        (2024, 'AYUNT', 'PARTIDO', 'VIDA_NL', 8),
        (2024, 'AYUNT', 'PARTIDO', 'ESO', 9),
        (2024, 'AYUNT', 'PARTIDO', 'LIBERAL', 10),
        (2024, 'AYUNT', 'PARTIDO', 'PESNL', 11),
        (2024, 'AYUNT', 'PARTIDO', 'JUSTICIALISTA', 12),
        (2024, 'AYUNT', 'COALICION', 'C_PAN_PRI_PRD', 13),
        (2024, 'AYUNT', 'COALICION', 'C_PAN_PRI', 14),
        (2024, 'AYUNT', 'COALICION', 'C_PAN_PRD', 15),
        (2024, 'AYUNT', 'COALICION', 'C_PRI_PRD', 16),
        (2024, 'AYUNT', 'COALICION', 'C_PVEM_MORENA', 17),
        (2024, 'AYUNT', 'INDEPENDIENTE', 'CI_1', 18)
       ) AS v(anio, eleccion, tipo, etiqueta, orden)
  JOIN sirve.entidad e ON e.clave = '19'
  JOIN sirve.proceso_electoral pr ON pr.id_entidad = e.id AND pr.anio = v.anio
  JOIN sirve.eleccion el ON el.id_proceso = pr.id AND el.clave = v.eleccion
  LEFT JOIN sirve.partido  pa ON v.tipo = 'PARTIDO'   AND pa.clave = v.etiqueta
  LEFT JOIN sirve.coalicion co ON v.tipo = 'COALICION' AND co.id_proceso = pr.id AND co.clave = v.etiqueta
 WHERE NOT EXISTS (SELECT 1 FROM sirve.opcion_boleta ob
                    WHERE ob.id_eleccion = el.id AND ob.orden = v.orden);

SELECT p.anio, el.clave, count(*) AS opciones
  FROM sirve.opcion_boleta ob
  JOIN sirve.eleccion el ON el.id = ob.id_eleccion
  JOIN sirve.proceso_electoral p ON p.id = el.id_proceso
 GROUP BY p.anio, el.clave, el.orden ORDER BY p.anio, el.orden;
