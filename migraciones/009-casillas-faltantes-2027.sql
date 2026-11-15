-- =====================================================================
-- SIRVE-P · Casillas faltantes de 2027
-- ---------------------------------------------------------------------
-- El catálogo de 2027 se cargó solo con casillas B y C1: dos por sección,
-- 6 228 en total. La elección de 2024 tiene además C2, C3, C4… y las
-- especiales E1, E2 con sus contiguas.
--
-- Este script agrega a 2027 las casillas que 2024 tenía en la misma sección y
-- que aquí faltan, tomando el tipo del catálogo de 2024.
--
-- Dos advertencias:
--
-- · Es una suposición razonable, no un dato oficial. Los tipos de casilla de
--   una sección cambian de una elección a otra según el número de electores.
--   Para la jornada real, el catálogo debe venir de la lista del INE o del
--   OPLE, no de aquí.
--
-- · Las 268 secciones que existen en 2027 y no en 2024 se quedan con B y C1:
--   no hay con qué compararlas.
--
-- Ejecutar como User_app en la base SIRVE.
-- =====================================================================

BEGIN;

-- 1) Crear las casillas que faltan, copiando el tipo del catálogo de 2024.
INSERT INTO sirve.casilla (id_seccion, clave, tipo, activa)
SELECT s27.id,
       p27.anio || '-NL-' || m.clave || '-' || s27.clave || '-' || c24.tipo,
       c24.tipo,
       true
  FROM sirve.casilla c24
  JOIN sirve.seccion s24 ON s24.id = c24.id_seccion
  JOIN sirve.proceso_electoral p24 ON p24.id = s24.id_proceso AND p24.anio = 2024
  JOIN sirve.seccion s27 ON s27.clave = s24.clave
  JOIN sirve.proceso_electoral p27 ON p27.id = s27.id_proceso AND p27.anio = 2027
  JOIN sirve.municipio m ON m.id = s27.id_municipio
 WHERE NOT EXISTS (
        SELECT 1 FROM sirve.casilla x
         WHERE x.id_seccion = s27.id AND x.tipo = c24.tipo)
ON CONFLICT (clave) DO NOTHING;

-- 2) Ligarlas a las cuatro elecciones de 2027.
INSERT INTO sirve.casilla_eleccion (id_casilla, id_eleccion)
SELECT c.id, e.id
  FROM sirve.casilla c
  JOIN sirve.seccion s ON s.id = c.id_seccion
  JOIN sirve.proceso_electoral p ON p.id = s.id_proceso AND p.anio = 2027
  CROSS JOIN sirve.eleccion e
  JOIN sirve.proceso_electoral pe ON pe.id = e.id_proceso AND pe.anio = 2027
 WHERE NOT EXISTS (
        SELECT 1 FROM sirve.casilla_eleccion ce
         WHERE ce.id_casilla = c.id AND ce.id_eleccion = e.id)
ON CONFLICT DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------
-- Comprobación
-- ---------------------------------------------------------------------
SELECT e.id, e.nombre,
       (SELECT count(*) FROM sirve.casilla_eleccion ce WHERE ce.id_eleccion = e.id) AS casillas
  FROM sirve.eleccion e
 WHERE e.id BETWEEN 7 AND 10
 ORDER BY e.id;

SELECT k.tipo, count(*) AS casillas
  FROM sirve.casilla k
  JOIN sirve.seccion s ON s.id = k.id_seccion
  JOIN sirve.proceso_electoral p ON p.id = s.id_proceso AND p.anio = 2027
 GROUP BY k.tipo
 ORDER BY length(k.tipo), k.tipo;
