-- =====================================================================
-- SIRVE-P · Estructura de casillas
-- ---------------------------------------------------------------------
-- Dos cambios:
--   1. tipo pasa de character(1) a text: los tipos reales son B, C1…C8,
--      E1, E1C3, ESPRP1, ESPMR1. Con un carácter no caben.
--   2. Nueva tabla casilla_eleccion: la casilla no se usa igual en todas
--      las elecciones del proceso (7 003 en gobernatura, 7 027 en
--      diputaciones; las especiales solo en algunas).
--
-- Requiere: 08-distritos.sql y 09-elecciones.sql.
--
-- Reejecutable, y también inofensivo cuando la columna ya es text, como en
-- una instalación nueva donde 00-esquema.sql ya trae el tipo correcto.
-- Sin la comprobación falla con «cannot alter type of a column used by a
-- view or rule», porque la vista v_casilla depende de esa columna.
-- =====================================================================

SET client_min_messages = warning;

-- 1. Tipo de casilla como texto, solo si todavía no lo es
DO $$
DECLARE
    tipo_actual text;
BEGIN
    SELECT format_type(a.atttypid, a.atttypmod)
      INTO tipo_actual
      FROM pg_attribute a
     WHERE a.attrelid = 'sirve.casilla'::regclass
       AND a.attname  = 'tipo'
       AND NOT a.attisdropped;

    IF tipo_actual IS DISTINCT FROM 'text' THEN
        ALTER TABLE sirve.casilla ALTER COLUMN tipo TYPE text;
        RAISE NOTICE 'casilla.tipo pasó de % a text', tipo_actual;
    ELSE
        RAISE NOTICE 'casilla.tipo ya es text; no hay nada que cambiar';
    END IF;
END $$;

ALTER TABLE sirve.casilla DROP CONSTRAINT IF EXISTS casilla_tipo_check;

COMMENT ON COLUMN sirve.casilla.tipo IS
    'B, C1…C8, E1, E1C3, ESP1, ESPRP1, ESPMR1: el tipo tal como lo nombra el acta.';

-- 2. Pertenencia casilla → elección
CREATE TABLE IF NOT EXISTS sirve.casilla_eleccion (
    id_casilla  integer  NOT NULL REFERENCES sirve.casilla (id) ON DELETE CASCADE,
    id_eleccion integer  NOT NULL REFERENCES sirve.eleccion (id) ON DELETE CASCADE,
    PRIMARY KEY (id_casilla, id_eleccion)
);
CREATE INDEX IF NOT EXISTS ix_casilla_eleccion_eleccion
    ON sirve.casilla_eleccion (id_eleccion);
