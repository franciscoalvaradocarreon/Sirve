-- =====================================================================
-- SIRVE-P · Heredar coordenadas de 2024 a las casillas de 2027
-- ---------------------------------------------------------------------
-- Igual que el 30 con los domicilios: las casillas de 2027 que tienen
-- una equivalente en 2024 (mismo municipio, sección y tipo) toman sus
-- coordenadas.
--
-- Solo llena las que están vacías: no pisa una coordenada corregida.
-- Reejecutable. Requiere 31 aplicado.
-- =====================================================================

SET client_min_messages = warning;

WITH mapa AS (
    SELECT k27.id AS id_2027,
           k24.latitud, k24.longitud, k24.geo_precision, k24.geo_fuente
      FROM sirve.seccion s27
      JOIN sirve.proceso_electoral p27 ON p27.id = s27.id_proceso AND p27.anio = 2027
      JOIN sirve.seccion s24
        ON s24.clave = s27.clave
       AND s24.id_municipio = s27.id_municipio
      JOIN sirve.proceso_electoral p24 ON p24.id = s24.id_proceso AND p24.anio = 2024
      JOIN sirve.casilla k27 ON k27.id_seccion = s27.id
      JOIN sirve.casilla k24 ON k24.id_seccion = s24.id AND k24.tipo = k27.tipo
     WHERE k24.latitud IS NOT NULL
)
UPDATE sirve.casilla k
   SET latitud       = m.latitud,
       longitud      = m.longitud,
       geo_precision = m.geo_precision,
       geo_fuente    = m.geo_fuente
  FROM mapa m
 WHERE k.id = m.id_2027
   AND k.latitud IS NULL;

-- Comprobación
SELECT p.anio, count(*) AS casillas,
       count(k.latitud) AS con_coordenadas,
       count(*) - count(k.latitud) AS sin_coordenadas
  FROM sirve.casilla k
  JOIN sirve.seccion s ON s.id = k.id_seccion
  JOIN sirve.proceso_electoral p ON p.id = s.id_proceso
 GROUP BY p.anio
 ORDER BY p.anio;
