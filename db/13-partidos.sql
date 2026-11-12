-- =====================================================================
-- SIRVE-P · Partidos (16)
-- ---------------------------------------------------------------------
-- Unión de los que aparecen en 2021 y 2024. Se usa el nombre de la columna
-- del libro como clave y como nombre; el nombre largo se puede corregir
-- después, es dato.
--
-- Reejecutable.
-- =====================================================================

SET client_min_messages = warning;

INSERT INTO sirve.partido (clave, nombre, orden, activo)
SELECT v.clave, v.nombre, v.orden, true
  FROM (VALUES
        ('PAN', 'PAN', 1),
        ('PRI', 'PRI', 2),
        ('PRD', 'PRD', 3),
        ('PVEM', 'PVEM', 4),
        ('PT', 'PT', 5),
        ('MC', 'MC', 6),
        ('MORENA', 'MORENA', 7),
        ('NANL', 'NANL', 8),
        ('PES', 'PES', 9),
        ('RSP', 'RSP', 10),
        ('FXM', 'FXM', 11),
        ('VIDA_NL', 'VIDA_NL', 12),
        ('ESO', 'ESO', 13),
        ('LIBERAL', 'LIBERAL', 14),
        ('PESNL', 'PESNL', 15),
        ('JUSTICIALISTA', 'JUSTICIALISTA', 16)
       ) AS v(clave, nombre, orden)
 WHERE NOT EXISTS (SELECT 1 FROM sirve.partido p WHERE p.clave = v.clave);

SELECT count(*) AS partidos FROM sirve.partido;
