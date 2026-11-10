-- =====================================================================
-- SIRVE-P · Capturistas y dispositivos
-- ---------------------------------------------------------------------
-- Cada capturista cubre varias casillas y puede usar hasta dos teléfonos.
-- El teléfono se enrola una sola vez con un código; de ahí en adelante lleva
-- un pase que lo identifica.
--
-- El pase NO se guarda: se guarda su hash. Si alguien copia la base, no puede
-- suplantar a nadie con lo que hay en ella.
--
-- Ejecutar en la base SIRVE, como dueño de las tablas:
--     psql -U User_app -d SIRVE -f migraciones/001-capturistas.sql
-- =====================================================================

BEGIN;

-- Las personas que capturan
CREATE TABLE IF NOT EXISTS sirve.capturista (
    id         serial      PRIMARY KEY,
    nombre     text        NOT NULL,
    telefono   text,
    activo     boolean     NOT NULL DEFAULT true,
    creado_en  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE sirve.capturista IS
    'Personas que capturan resultados. El nombre queda en captura.capturada_por.';

-- Qué casillas cubre cada quien
CREATE TABLE IF NOT EXISTS sirve.capturista_casilla (
    id_capturista integer NOT NULL REFERENCES sirve.capturista (id) ON DELETE CASCADE,
    id_casilla    integer NOT NULL REFERENCES sirve.casilla (id)    ON DELETE CASCADE,
    PRIMARY KEY (id_capturista, id_casilla)
);

CREATE INDEX IF NOT EXISTS ix_capturista_casilla_casilla
    ON sirve.capturista_casilla (id_casilla);

-- Los teléfonos enrolados
CREATE TABLE IF NOT EXISTS sirve.dispositivo (
    id           serial      PRIMARY KEY,
    id_capturista integer    NOT NULL REFERENCES sirve.capturista (id) ON DELETE CASCADE,
    nombre       text,
    codigo_hash  text        NOT NULL,
    pase_hash    text,
    activo       boolean     NOT NULL DEFAULT true,
    creado_en    timestamptz NOT NULL DEFAULT now(),
    enrolado_en  timestamptz,
    ultimo_uso   timestamptz
);

COMMENT ON COLUMN sirve.dispositivo.codigo_hash IS
    'Hash del código de enrolamiento. Un solo uso: al enrolar se borra.';
COMMENT ON COLUMN sirve.dispositivo.pase_hash IS
    'Hash del pase que lleva la aplicación. El pase en claro solo lo tiene el teléfono.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_dispositivo_codigo
    ON sirve.dispositivo (codigo_hash);

CREATE INDEX IF NOT EXISTS ix_dispositivo_pase
    ON sirve.dispositivo (pase_hash);

-- Quién capturó: el capturista y el teléfono desde el que se envió.
-- captura.capturada_por es uuid y aquí se usa un id entero, así que van en
-- columnas propias en lugar de reutilizar aquella.
ALTER TABLE sirve.captura
    ADD COLUMN IF NOT EXISTS id_capturista  integer REFERENCES sirve.capturista (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS id_dispositivo integer REFERENCES sirve.dispositivo (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_captura_capturista ON sirve.captura (id_capturista);

-- El rol de la aplicación necesita operar estas tablas
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sirve_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON sirve.capturista         TO sirve_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON sirve.capturista_casilla TO sirve_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON sirve.dispositivo        TO sirve_app;
        GRANT USAGE, SELECT ON SEQUENCE sirve.capturista_id_seq TO sirve_app;
        GRANT USAGE, SELECT ON SEQUENCE sirve.dispositivo_id_seq TO sirve_app;
    END IF;
END $$;

COMMIT;
