-- =====================================================================
-- SIRVE-P · Vista plana de casilla
-- ---------------------------------------------------------------------
-- Entrega la casilla con su año, municipio y sus dos distritos en una
-- sola fila, sin duplicar esos datos en la tabla.
--
-- Por qué no se agregan como columnas a `casilla`:
--   · el año vive en proceso_electoral y ya va codificado en la clave
--   · los distritos son de la sección, no de la casilla (verificado: no
--     hay una sección con casillas en distritos distintos)
--   · duplicarlos obliga a corregir dos lugares y nada detecta el olvido
--
-- La vista se comporta como una tabla al consultarla y se mantiene sola.
--
-- Reejecutable.
-- =====================================================================

SET client_min_messages = warning;

CREATE OR REPLACE VIEW sirve.v_casilla AS
SELECT k.id,
       k.clave,
       k.tipo,
       k.activa,
       k.direccion,
       s.id            AS id_seccion,
       s.clave         AS seccion,
       p.id            AS id_proceso,
       p.anio,
       e.id            AS id_entidad,
       e.clave         AS entidad_clave,
       e.nombre        AS entidad,
       m.id            AS id_municipio,
       m.clave         AS municipio_clave,
       m.nombre        AS municipio,
       s.id_distrito_local,
       dl.clave        AS distrito_local,
       dl.nombre       AS distrito_local_nombre,
       s.id_distrito_federal,
       df.clave        AS distrito_federal,
       df.nombre       AS distrito_federal_nombre
  FROM sirve.casilla k
  JOIN sirve.seccion s           ON s.id  = k.id_seccion
  JOIN sirve.proceso_electoral p ON p.id  = s.id_proceso
  JOIN sirve.entidad e           ON e.id  = p.id_entidad
  JOIN sirve.municipio m         ON m.id  = s.id_municipio
  LEFT JOIN sirve.distrito dl    ON dl.id = s.id_distrito_local
  LEFT JOIN sirve.distrito df    ON df.id = s.id_distrito_federal;

COMMENT ON VIEW sirve.v_casilla IS
    'Casilla con año, municipio y distritos local y federal. Sustituye duplicar esas columnas en la tabla.';

-- Comprobación
SELECT anio, count(*) AS casillas,
       count(distrito_local)   AS con_local,
       count(distrito_federal) AS con_federal
  FROM sirve.v_casilla
 GROUP BY anio
 ORDER BY anio;

SELECT id, clave, anio, municipio, distrito_local, distrito_federal
  FROM sirve.v_casilla
 ORDER BY clave
 LIMIT 5;
