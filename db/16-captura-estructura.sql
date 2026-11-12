-- =====================================================================
-- SIRVE-P · Ajuste de la tabla de captura
-- ---------------------------------------------------------------------
-- La tabla captura venía del modelo anterior. Le faltan tres cosas para
-- que sostenga el MVP:
--
--   1. Que la captura solo pueda existir donde la casilla está declarada
--      para esa elección (hoy apunta a casilla y a elección por separado).
--   2. Una sola captura por casilla y elección, para que recapturar sea un
--      upsert y no un duplicado.
--   3. Estado por defecto VIGENTE; venía RECIBIDA, que no cuenta para el
--      tablero.
--
-- Reejecutable. Requiere: 10-casilla-estructura.sql y 11/12 cargados.
-- =====================================================================

SET client_min_messages = warning;

-- 1. La captura apunta al par casilla-elección, no a cada uno por su lado.
ALTER TABLE sirve.captura DROP CONSTRAINT IF EXISTS fk_captura_casilla_eleccion;

ALTER TABLE sirve.captura
    ADD CONSTRAINT fk_captura_casilla_eleccion
    FOREIGN KEY (id_casilla, id_eleccion)
    REFERENCES sirve.casilla_eleccion (id_casilla, id_eleccion);

-- 2. Una captura por casilla y elección: recapturar sobrescribe.
ALTER TABLE sirve.captura DROP CONSTRAINT IF EXISTS ux_captura_casilla_eleccion;

ALTER TABLE sirve.captura
    ADD CONSTRAINT ux_captura_casilla_eleccion UNIQUE (id_casilla, id_eleccion);

-- 3. El estado con el que nace una captura es VIGENTE, y la regla que exigía
--    vigente_desde se retira: era del modelo con versiones (REEMPLAZADA),
--    donde un disparador ponía la fecha. En el MVP hay una sola captura por
--    casilla y elección, así que esa columna no aporta nada.
ALTER TABLE sirve.captura ALTER COLUMN estado SET DEFAULT 'VIGENTE';
ALTER TABLE sirve.captura DROP CONSTRAINT IF EXISTS ck_captura_vigente_cols;

-- 4. Comprobación
SELECT conname, pg_get_constraintdef(oid) AS definicion
  FROM pg_constraint
 WHERE conrelid = 'sirve.captura'::regclass
   AND conname LIKE '%casilla%'
 ORDER BY conname;
