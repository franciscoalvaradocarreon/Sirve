-- =====================================================================
-- SIRVE-P · Proceso 2027 preparado para pruebas de pantalla
-- ---------------------------------------------------------------------
-- 2027 no tiene catálogo propio todavía (la autoridad no lo ha publicado).
-- Para poder probar las pantallas se copia la estructura de 2024:
--
--   1. Secciones de 2024, con sus distritos local y federal.
--   2. Casillas de 2024, con la clave cambiada a 2027.
--   3. Cuatro elecciones: diputaciones locales, ayuntamientos,
--      gobernatura y diputaciones federales.
--   4. Cada casilla queda declarada en las cuatro elecciones.
--   5. Las opciones de boleta se copian de 2024:
--        DIP     ← DIP 2024     (17)
--        AYUNT   ← AYUNT 2024   (18)
--        GOB     ← DIP 2024     (17)  no hay gobernatura en 2024
--        DIPFED  ← DIP 2024     (17)  idem para la federal
--
-- Las capturas quedan vacías a propósito: se llenan desde la pantalla.
--
-- Reejecutable. Requiere los catálogos de 2024 cargados.
-- =====================================================================

SET client_min_messages = warning;

BEGIN;

-- 1. Secciones ---------------------------------------------------------
INSERT INTO sirve.seccion (id_proceso, id_municipio, clave, lista_nominal,
                           id_distrito_local, id_distrito_federal)
SELECT p27.id, s.id_municipio, s.clave, s.lista_nominal,
       s.id_distrito_local, s.id_distrito_federal
  FROM sirve.seccion s
  JOIN sirve.proceso_electoral p24 ON p24.id = s.id_proceso AND p24.anio = 2024
  JOIN sirve.proceso_electoral p27 ON p27.anio = 2027 AND p27.id_entidad = p24.id_entidad
 WHERE NOT EXISTS (SELECT 1 FROM sirve.seccion x
                    WHERE x.id_proceso = p27.id
                      AND x.id_municipio = s.id_municipio
                      AND x.clave = s.clave);

-- 2. Casillas ----------------------------------------------------------
INSERT INTO sirve.casilla (id_seccion, clave, tipo, direccion, activa)
SELECT s27.id,
       '2027' || substr(k.clave, 5),      -- cambia el año de la clave
       k.tipo, k.direccion, k.activa
  FROM sirve.casilla k
  JOIN sirve.seccion s24 ON s24.id = k.id_seccion
  JOIN sirve.proceso_electoral p24 ON p24.id = s24.id_proceso AND p24.anio = 2024
  JOIN sirve.proceso_electoral p27 ON p27.anio = 2027 AND p27.id_entidad = p24.id_entidad
  JOIN sirve.seccion s27 ON s27.id_proceso = p27.id
                        AND s27.id_municipio = s24.id_municipio
                        AND s27.clave = s24.clave
 WHERE NOT EXISTS (SELECT 1 FROM sirve.casilla x
                    WHERE x.clave = '2027' || substr(k.clave, 5));

-- 3. Elecciones --------------------------------------------------------
INSERT INTO sirve.eleccion (id_proceso, clave, nombre, tipo, orden, capturable, activa)
SELECT p27.id, v.clave, v.nombre, v.tipo::sirve.tipo_eleccion, v.orden, true, true
  FROM (VALUES
        ('DIP',    'Diputaciones locales 2027',   'DIPUTACION_LOCAL',     1),
        ('AYUNT',  'Ayuntamientos 2027',          'PRESIDENCIA_MUNICIPAL', 2),
        ('GOB',    'Gobernatura 2027',            'GOBERNATURA',          3),
        ('DIPFED', 'Diputaciones federales 2027', 'DIPUTACION_FEDERAL',   4)
       ) AS v(clave, nombre, tipo, orden)
  JOIN sirve.proceso_electoral p27 ON p27.anio = 2027
  JOIN sirve.entidad e ON e.id = p27.id_entidad AND e.clave = '19'
 WHERE NOT EXISTS (SELECT 1 FROM sirve.eleccion x
                    WHERE x.id_proceso = p27.id AND x.clave = v.clave);

-- 4. Pertenencia casilla → elección ------------------------------------
INSERT INTO sirve.casilla_eleccion (id_casilla, id_eleccion)
SELECT k.id, el.id
  FROM sirve.casilla k
  JOIN sirve.seccion s ON s.id = k.id_seccion
  JOIN sirve.proceso_electoral p ON p.id = s.id_proceso AND p.anio = 2027
  JOIN sirve.eleccion el ON el.id_proceso = p.id
 WHERE NOT EXISTS (SELECT 1 FROM sirve.casilla_eleccion x
                    WHERE x.id_casilla = k.id AND x.id_eleccion = el.id);

-- 5. Opciones de boleta, copiadas de su equivalente de 2024 ------------
INSERT INTO sirve.opcion_boleta (id_eleccion, tipo, id_partido, id_coalicion,
                                 etiqueta, orden, activo)
SELECT el27.id, ob.tipo, ob.id_partido, ob.id_coalicion,
       ob.etiqueta, ob.orden, ob.activo
  FROM (VALUES
        ('DIP',    'DIP'),
        ('AYUNT',  'AYUNT'),
        ('DIP',    'GOB'),
        ('DIP',    'DIPFED')
       ) AS mapa(origen, destino)
  JOIN sirve.proceso_electoral p24 ON p24.anio = 2024
  JOIN sirve.proceso_electoral p27 ON p27.anio = 2027 AND p27.id_entidad = p24.id_entidad
  JOIN sirve.eleccion el24 ON el24.id_proceso = p24.id AND el24.clave = mapa.origen
  JOIN sirve.eleccion el27 ON el27.id_proceso = p27.id AND el27.clave = mapa.destino
  JOIN sirve.opcion_boleta ob ON ob.id_eleccion = el24.id
 WHERE NOT EXISTS (SELECT 1 FROM sirve.opcion_boleta x
                    WHERE x.id_eleccion = el27.id AND x.orden = ob.orden);

COMMIT;

-- Comprobación ---------------------------------------------------------
SELECT e.clave, e.nombre,
       (SELECT count(*) FROM sirve.casilla_eleccion ce WHERE ce.id_eleccion = e.id) AS casillas,
       (SELECT count(*) FROM sirve.opcion_boleta ob WHERE ob.id_eleccion = e.id)     AS opciones
  FROM sirve.eleccion e
  JOIN sirve.proceso_electoral p ON p.id = e.id_proceso
 WHERE p.anio = 2027
 ORDER BY e.orden;

SELECT count(*) AS secciones FROM sirve.seccion s
  JOIN sirve.proceso_electoral p ON p.id = s.id_proceso WHERE p.anio = 2027;

SELECT count(*) AS casillas FROM sirve.casilla k
  JOIN sirve.seccion s ON s.id = k.id_seccion
  JOIN sirve.proceso_electoral p ON p.id = s.id_proceso WHERE p.anio = 2027;
