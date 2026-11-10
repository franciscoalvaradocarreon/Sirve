-- =====================================================================
-- SIRVE-P · Asignación por secciones
-- ---------------------------------------------------------------------
-- Cambia el modelo: al capturista se le asignan SECCIONES, y de ahí salen
-- todas sus casillas. Es como se reparte el trabajo en campo —una sección
-- completa, no casillas sueltas— y además deja el catálogo más corto.
--
-- Sustituye a capturista_casilla, que asignaba casilla por casilla.
--
-- Ejecutar como postgres, en la base SIRVE.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sirve.capturista_seccion (
    id_capturista integer NOT NULL REFERENCES sirve.capturista (id) ON DELETE CASCADE,
    id_seccion    integer NOT NULL REFERENCES sirve.seccion (id)    ON DELETE CASCADE,
    PRIMARY KEY (id_capturista, id_seccion)
);

CREATE INDEX IF NOT EXISTS ix_capturista_seccion_seccion
    ON sirve.capturista_seccion (id_seccion);

COMMENT ON TABLE sirve.capturista_seccion IS
    'Secciones que cubre cada capturista. Sus casillas salen de aquí.';

-- El modelo anterior, casilla por casilla, ya no se usa.
DROP TABLE IF EXISTS sirve.capturista_casilla;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sirve_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON sirve.capturista_seccion TO "User_app", sirve_app;
    END IF;
END $$;

COMMIT;
