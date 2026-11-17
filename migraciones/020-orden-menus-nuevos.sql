-- =====================================================================
-- SIRVE-P · Orden de los menús nuevos
-- ---------------------------------------------------------------------
-- Partidos, Coaliciones y Boletas se insertaron con orden 40, 41 y 42, que es
-- el rango del grupo Operación. En la matriz de menús por rol aparecían
-- intercalados entre Capturistas y Usuarios, aunque colgaran de Catálogos.
--
-- Aquí se les da el orden que les toca: 27, 28 y 29, justo después de Casillas.
-- También se normaliza la clave del menú de partidos, que en desarrollo quedó
-- como «catalogo».
--
-- Es idempotente: si ya están en su sitio, no cambia nada.
--
-- Ejecutar como User_app en la base SIRVE.
-- =====================================================================

BEGIN;

UPDATE sirve.menu SET orden = 27 WHERE clave = 'partidos';
UPDATE sirve.menu SET orden = 28 WHERE clave = 'coaliciones';
UPDATE sirve.menu SET orden = 29 WHERE clave = 'boletas';

-- En desarrollo el menú de partidos se creó con la clave «catalogo».
UPDATE sirve.menu SET clave = 'partidos'
 WHERE clave = 'catalogo' AND ruta = '/catalogos/partidos';

COMMIT;

SELECT m.clave, m.etiqueta, m.orden, p.clave AS padre
  FROM sirve.menu m LEFT JOIN sirve.menu p ON p.id = m.id_padre
 ORDER BY coalesce(p.orden, m.orden), (m.id_padre IS NOT NULL), m.orden, m.id;