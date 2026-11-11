-- =====================================================================
-- SIRVE-P · Foto del acta
-- ---------------------------------------------------------------------
-- Una foto por casilla y elección. Opcional: la captura se guarda igual sin
-- ella, y puede subirse después.
--
-- El archivo vive en disco; aquí solo va la ruta y los metadatos. Guardar
-- imágenes en la base la engorda y complica los respaldos sin ganar nada.
--
-- Ejecutar como postgres (o como el dueño del esquema), en la base SIRVE.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sirve.acta_foto (
    id              serial      PRIMARY KEY,
    id_casilla      integer     NOT NULL REFERENCES sirve.casilla (id)  ON DELETE CASCADE,
    id_eleccion     integer     NOT NULL REFERENCES sirve.eleccion (id) ON DELETE CASCADE,
    ruta            text        NOT NULL,
    bytes           integer     NOT NULL,
    subida_en       timestamptz NOT NULL DEFAULT now(),
    id_capturista   integer     REFERENCES sirve.capturista (id)  ON DELETE SET NULL,
    id_dispositivo  integer     REFERENCES sirve.dispositivo (id) ON DELETE SET NULL,
    UNIQUE (id_casilla, id_eleccion)
);

COMMENT ON TABLE sirve.acta_foto IS
    'Foto del acta por casilla. El archivo está en disco; aquí la referencia.';

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sirve_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON sirve.acta_foto TO "User_app", sirve_app;
        GRANT USAGE, SELECT ON SEQUENCE sirve.acta_foto_id_seq TO "User_app", sirve_app;
    ELSE
        GRANT SELECT, INSERT, UPDATE, DELETE ON sirve.acta_foto TO "User_app";
        GRANT USAGE, SELECT ON SEQUENCE sirve.acta_foto_id_seq TO "User_app";
    END IF;
END $$;

COMMIT;
