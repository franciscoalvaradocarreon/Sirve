-- =====================================================================
-- SIRVE-P · Limpieza: la sección 0 no existe
-- ---------------------------------------------------------------------
-- Las filas de VOTO ANTICIPADO de los libros usan SECCION = 0 como
-- marcador. Al cargar secciones se colaron 20 registros con clave '0',
-- uno por municipio.
--
-- No es una sección territorial: no tiene casillas ni lista nominal, y
-- nadie captura en ella. Se elimina.
--
-- Reejecutable: si ya no hay filas, no hace nada.
-- =====================================================================

SET client_min_messages = warning;

-- Solo se borran las secciones '0' que no tengan casillas colgando.
DELETE FROM sirve.seccion s
 WHERE s.clave = '0'
   AND NOT EXISTS (SELECT 1 FROM sirve.casilla k WHERE k.id_seccion = s.id);

SELECT p.anio, count(*) AS secciones
  FROM sirve.seccion s
  JOIN sirve.proceso_electoral p ON p.id = s.id_proceso
 GROUP BY p.anio
 ORDER BY p.anio;
