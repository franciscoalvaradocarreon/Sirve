-- =====================================================================
-- SIRVE-P · Usuarios, roles y menús
-- ---------------------------------------------------------------------
-- Trae el modelo del SIH, sin escuelas ni semestres: quién entra, con qué
-- rol y qué menús ve. El móvil NO usa esto: sigue con el código de
-- enrolamiento y su pase.
--
-- Es idempotente y autosuficiente: si la base ya tiene usuario y el enum de
-- roles —como desarrollo—, los respeta; si no —como producción—, los crea.
--
-- Ejecutar como postgres (o el dueño del esquema), en la base SIRVE.
-- =====================================================================

BEGIN;

-- ----------------------------------------------------- roles del sistema
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                    WHERE t.typname = 'rol_usuario' AND n.nspname = 'sirve') THEN
        CREATE TYPE sirve.rol_usuario AS ENUM
            ('ADMIN', 'COORDINADOR', 'OPERADOR', 'ANALISTA', 'AUDITOR');
    END IF;
END $$;

-- -------------------------------------------------------------- usuarios
CREATE TABLE IF NOT EXISTS sirve.usuario (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario            text NOT NULL UNIQUE,
    nombre             text NOT NULL,
    rol                sirve.rol_usuario NOT NULL,
    -- BCrypt: 60 caracteres, empieza con $2a$, $2b$ o $2y$. Se comprueba en la
    -- base para que nunca entre una contraseña en claro por descuido.
    hash_password      text NOT NULL,
    activo             boolean NOT NULL DEFAULT true,
    intentos_fallidos  smallint NOT NULL DEFAULT 0,
    bloqueado_hasta    timestamptz,
    ultimo_acceso      timestamptz,
    creado_en          timestamptz NOT NULL DEFAULT now(),
    -- Contador de sesiones: al cerrar sesión o cambiar la contraseña se
    -- incrementa y los tokens emitidos antes dejan de valer al instante.
    token_version      integer NOT NULL DEFAULT 0
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conname = 'ck_password_bcrypt'
                      AND conrelid = 'sirve.usuario'::regclass) THEN
        ALTER TABLE sirve.usuario
            ADD CONSTRAINT ck_password_bcrypt
            CHECK (hash_password ~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$');
    END IF;
END $$;

-- ---------------------------------------------------------------- menús
CREATE TABLE IF NOT EXISTS sirve.menu (
    id        serial      PRIMARY KEY,
    clave     varchar(50) NOT NULL UNIQUE,
    etiqueta  varchar(80) NOT NULL,
    ruta      varchar(120),
    icono     varchar(40),
    id_padre  integer     REFERENCES sirve.menu (id) ON DELETE CASCADE,
    orden     integer     NOT NULL DEFAULT 0,
    activo    boolean     NOT NULL DEFAULT true
);

-- Los permisos se guardan contra el enum de roles, sin tabla aparte.
CREATE TABLE IF NOT EXISTS sirve.rol_menu (
    rol      sirve.rol_usuario NOT NULL,
    id_menu  integer           NOT NULL REFERENCES sirve.menu (id) ON DELETE CASCADE,
    PRIMARY KEY (rol, id_menu)
);

-- ------------------------------------------------------- siembra de menús
INSERT INTO sirve.menu (clave, etiqueta, ruta, icono, orden) VALUES
    ('inicio',     'Inicio',           '/',                     'Home',        10),
    ('catalogos',  'Catálogos',        NULL,                    'Library',     20),
    ('procesos',   'Procesos',         '/catalogos/procesos',   'Calendar',    21),
    ('elecciones', 'Elecciones',       '/catalogos/elecciones', 'Vote',        22),
    ('municipios', 'Municipios',       '/catalogos/municipios', 'MapPin',      23),
    ('distritos',  'Distritos',        '/catalogos/distritos',  'Map',         24),
    ('secciones',  'Secciones',        '/catalogos/secciones',  'Hash',        25),
    ('casillas',   'Casillas',         '/catalogos/casillas',   'Home',        26),
    ('captura',    'Captura',          NULL,                    'PencilLine',  30),
    ('capturar',   'Capturar casilla', '/captura',              'ClipboardList', 31),
    ('consultar',  'Consultar',        '/captura/consulta',     'ListChecks',  32),
    ('operacion',  'Operación',        NULL,                    'Users',       40),
    ('capturistas','Capturistas',      '/capturistas',          'UserCog',     41),
    ('usuarios',   'Usuarios',         '/usuarios',             'ShieldCheck', 42),
    ('reportes',   'Reportes',         NULL,                    'BarChart3',   50),
    ('avance',     'Avance',           '/reportes/avance',      'ChartColumn', 51),
    ('asignacion', 'Asignación',       '/reportes/asignacion',  'ListTree',    52),
    ('actas',      'Actas',            '/reportes/actas',       'Images',      53)
ON CONFLICT (clave) DO NOTHING;

UPDATE sirve.menu h SET id_padre = (SELECT id FROM sirve.menu WHERE clave = 'catalogos')
 WHERE h.clave IN ('procesos','elecciones','municipios','distritos','secciones','casillas');

UPDATE sirve.menu h SET id_padre = (SELECT id FROM sirve.menu WHERE clave = 'captura')
 WHERE h.clave IN ('capturar','consultar');

UPDATE sirve.menu h SET id_padre = (SELECT id FROM sirve.menu WHERE clave = 'operacion')
 WHERE h.clave IN ('capturistas','usuarios');

UPDATE sirve.menu h SET id_padre = (SELECT id FROM sirve.menu WHERE clave = 'reportes')
 WHERE h.clave IN ('avance','asignacion','actas');

-- -------------------------------------------------- permisos por defecto
INSERT INTO sirve.rol_menu (rol, id_menu)
SELECT 'ADMIN'::sirve.rol_usuario, id FROM sirve.menu
ON CONFLICT DO NOTHING;

INSERT INTO sirve.rol_menu (rol, id_menu)
SELECT 'COORDINADOR'::sirve.rol_usuario, id FROM sirve.menu WHERE clave <> 'usuarios'
ON CONFLICT DO NOTHING;

INSERT INTO sirve.rol_menu (rol, id_menu)
SELECT 'OPERADOR'::sirve.rol_usuario, id FROM sirve.menu
 WHERE clave IN ('inicio','captura','capturar','consultar')
ON CONFLICT DO NOTHING;

INSERT INTO sirve.rol_menu (rol, id_menu)
SELECT r::sirve.rol_usuario, m.id
  FROM unnest(ARRAY['ANALISTA','AUDITOR']) AS r
  CROSS JOIN sirve.menu m
 WHERE m.clave IN ('inicio','reportes','avance','asignacion','actas')
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------- permisos
-- Cada rol se concede solo si existe: en una instalación limpia —la del CI, por
-- ejemplo— los roles los crea el script de la base, y esta migración puede
-- correr antes. Negarse a seguir por un rol ausente obligaría a inventarlo.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'User_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON sirve.usuario, sirve.menu, sirve.rol_menu
            TO "User_app";
        GRANT USAGE, SELECT ON SEQUENCE sirve.menu_id_seq TO "User_app";
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sirve_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON sirve.usuario, sirve.menu, sirve.rol_menu
            TO sirve_app;
        GRANT USAGE, SELECT ON SEQUENCE sirve.menu_id_seq TO sirve_app;
    END IF;
END $$;

COMMIT;

-- El primer usuario lo crea la aplicación al arrancar, si la tabla está
-- vacía: usuario «admin» con la contraseña de ADMIN_CLAVE o, si no está
-- definida, una aleatoria que se escribe una sola vez en el registro.
