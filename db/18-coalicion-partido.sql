-- =====================================================================
-- SIRVE-P · Integrantes de cada coalición
-- ---------------------------------------------------------------------
-- Llena coalicion_partido a partir del nombre de la coalición:
--     C_PVEM_PT_MORENA_PANAL  →  PVEM, PT, MORENA, NANL
--
-- OJO con el mapeo: los nombres de coalición usan PANAL, pero el catálogo
-- de partidos usa NANL. Es el mismo partido (Nueva Alianza) con dos
-- acrónimos. Sin ese mapeo, 7 coaliciones quedarían incompletas.
--
-- Esto es informativo: sirve para saber quién integra cada coalición.
-- NO sirve para repartir los votos de la coalición entre sus partidos,
-- porque el acta no los desglosa.
--
-- Reejecutable. Requiere 13-partidos.sql y 14-coaliciones.sql.
-- =====================================================================

SET client_min_messages = warning;

INSERT INTO sirve.coalicion_partido (id_coalicion, id_partido)
SELECT c.id, p.id
  FROM sirve.coalicion c
 CROSS JOIN LATERAL unnest(string_to_array(substr(c.clave, 3), '_')) AS t(token)
  JOIN sirve.partido p
    ON p.clave = CASE WHEN t.token = 'PANAL' THEN 'NANL' ELSE t.token END
 WHERE NOT EXISTS (SELECT 1 FROM sirve.coalicion_partido cp
                    WHERE cp.id_coalicion = c.id AND cp.id_partido = p.id);

-- Control: ningún token debe quedar sin resolver.
-- Si esta consulta devuelve filas, falta un partido en el catálogo.
SELECT c.clave AS coalicion, t.token AS sin_partido
  FROM sirve.coalicion c
 CROSS JOIN LATERAL unnest(string_to_array(substr(c.clave, 3), '_')) AS t(token)
 WHERE NOT EXISTS (SELECT 1 FROM sirve.partido p
                    WHERE p.clave = CASE WHEN t.token = 'PANAL' THEN 'NANL' ELSE t.token END)
 ORDER BY 1;

-- Resultado
SELECT c.clave AS coalicion, string_agg(p.clave, ' + ' ORDER BY p.clave) AS integrantes
  FROM sirve.coalicion_partido cp
  JOIN sirve.coalicion c ON c.id = cp.id_coalicion
  JOIN sirve.partido p ON p.id = cp.id_partido
 GROUP BY c.clave
 ORDER BY c.clave;
