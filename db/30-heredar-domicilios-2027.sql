-- =====================================================================
-- SIRVE-P · Heredar domicilios de 2024 a las casillas de 2027
-- ---------------------------------------------------------------------
-- De las 3 114 secciones de 2027, 2 846 ya existían en 2024 y conservan
-- número y municipio. Sus casillas B y C1 pueden tomar el domicilio que
-- el INE reportó para la misma sección y tipo en 2024.
--
-- Resultado esperado:
--   5 692 casillas con domicilio   (2 846 secciones × 2)
--     536 casillas sin domicilio   (268 secciones nuevas, 3 0xx)
--
-- ADVERTENCIA: es una herencia, no un dato oficial. Si una sección se
-- partió, el domicilio heredado puede quedar del lado equivocado. Sirve
-- para pruebas y se reemplaza cuando salga el catálogo de 2027.
--
-- Solo llena las que están vacías: no pisa un domicilio ya corregido.
-- Reejecutable. Requiere 29 aplicado.
-- =====================================================================

SET client_min_messages = warning;

WITH mapa AS (
    SELECT k27.id AS id_2027,
           k24.direccion, k24.ubicacion, k24.referencia
      FROM sirve.seccion s27
      JOIN sirve.proceso_electoral p27 ON p27.id = s27.id_proceso AND p27.anio = 2027
      JOIN sirve.seccion s24
        ON s24.clave = s27.clave
       AND s24.id_municipio = s27.id_municipio
      JOIN sirve.proceso_electoral p24 ON p24.id = s24.id_proceso AND p24.anio = 2024
      JOIN sirve.casilla k27 ON k27.id_seccion = s27.id
      JOIN sirve.casilla k24 ON k24.id_seccion = s24.id AND k24.tipo = k27.tipo
     WHERE k24.direccion IS NOT NULL
)
UPDATE sirve.casilla k
   SET direccion  = m.direccion,
       ubicacion  = m.ubicacion,
       referencia = m.referencia
  FROM mapa m
 WHERE k.id = m.id_2027
   AND k.direccion IS NULL;

-- Comprobación
SELECT count(*)                    AS casillas_2027,
       count(k.direccion)          AS con_domicilio,
       count(*) - count(k.direccion) AS sin_domicilio
  FROM sirve.casilla k
  JOIN sirve.seccion s ON s.id = k.id_seccion
  JOIN sirve.proceso_electoral p ON p.id = s.id_proceso
 WHERE p.anio = 2027;

SELECT count(*) AS secciones_sin_domicilio
  FROM sirve.seccion s
  JOIN sirve.proceso_electoral p ON p.id = s.id_proceso
 WHERE p.anio = 2027
   AND NOT EXISTS (SELECT 1 FROM sirve.casilla k
                    WHERE k.id_seccion = s.id AND k.direccion IS NOT NULL);

SELECT m.nombre AS municipio, s.clave AS seccion, k.tipo, k.ubicacion
  FROM sirve.casilla k
  JOIN sirve.seccion s ON s.id = k.id_seccion
  JOIN sirve.proceso_electoral p ON p.id = s.id_proceso
  JOIN sirve.municipio m ON m.id = s.id_municipio
 WHERE p.anio = 2027 AND k.direccion IS NOT NULL
 ORDER BY k.clave
 LIMIT 5;
