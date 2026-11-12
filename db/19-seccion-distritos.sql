-- =====================================================================
-- SIRVE-P · Los distritos pertenecen a la sección
-- ---------------------------------------------------------------------
-- Comprobado en los datos: ninguna sección tiene casillas en distritos
-- locales distintos. El distrito es un atributo de la sección, no de la
-- casilla, y hoy está guardado en casilla.
--
-- Qué hace:
--   1. Agrega id_distrito_local e id_distrito_federal a seccion.
--   2. Rellena el local desde las casillas existentes.
--   3. Retira casilla.id_distrito, que queda duplicado.
--
-- El distrito FEDERAL queda en NULL: los libros de resultados solo traen
-- el distrito local. Se llena cuando tengamos la cartografía del INE.
--
-- Reejecutable.
-- =====================================================================

SET client_min_messages = warning;

-- 1. Columnas
ALTER TABLE sirve.seccion ADD COLUMN IF NOT EXISTS id_distrito_local   integer;
ALTER TABLE sirve.seccion ADD COLUMN IF NOT EXISTS id_distrito_federal integer;

-- 2. Rellenar el local desde las casillas.
--    Solo la primera vez: después, la columna de casilla ya no existe.
DO $bloque$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_attribute
                WHERE attrelid = 'sirve.casilla'::regclass
                  AND attname = 'id_distrito' AND NOT attisdropped) THEN
        EXECUTE 'UPDATE sirve.seccion s
                    SET id_distrito_local = x.id_distrito
                   FROM (SELECT id_seccion, min(id_distrito) AS id_distrito
                           FROM sirve.casilla
                          WHERE id_distrito IS NOT NULL
                          GROUP BY id_seccion) x
                  WHERE x.id_seccion = s.id
                    AND s.id_distrito_local IS NULL';
    END IF;
END $bloque$;

-- 3. Claves foráneas
DO $bloque$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conname = 'fk_seccion_distrito_local'
                      AND conrelid = 'sirve.seccion'::regclass) THEN
        ALTER TABLE sirve.seccion
            ADD CONSTRAINT fk_seccion_distrito_local
            FOREIGN KEY (id_distrito_local) REFERENCES sirve.distrito (id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conname = 'fk_seccion_distrito_federal'
                      AND conrelid = 'sirve.seccion'::regclass) THEN
        ALTER TABLE sirve.seccion
            ADD CONSTRAINT fk_seccion_distrito_federal
            FOREIGN KEY (id_distrito_federal) REFERENCES sirve.distrito (id);
    END IF;
END $bloque$;

-- 4. Retirar la columna duplicada de casilla
ALTER TABLE sirve.casilla DROP COLUMN IF EXISTS id_distrito;

-- 5. Comprobación
SELECT count(*) AS secciones,
       count(id_distrito_local)   AS con_distrito_local,
       count(id_distrito_federal) AS con_distrito_federal
  FROM sirve.seccion;
