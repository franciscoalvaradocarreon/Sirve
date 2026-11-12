-- =====================================================================
-- SIRVE-P · Menús por rol
-- ---------------------------------------------------------------------
-- La tabla de usuarios ya existía, con su enum `rol_usuario`
-- (ADMIN, COORDINADOR, OPERADOR, ANALISTA, AUDITOR). No se toca ni se
-- duplica: lo que faltaba era decidir qué menús ve cada rol.
--
-- Se agrega una sola columna a usuario: el contador de sesiones, que es lo
-- que permite que cerrar sesión invalide el token de verdad.
--
-- Ejecutar como postgres (o el dueño del esquema), en la base SIRVE.
-- =====================================================================

BEGIN;

-- Contador de sesiones: al cerrar sesión o cambiar la contraseña se
-- incrementa y los tokens emitidos antes dejan de valer al instante.
ALTER TABLE sirve.usuario
    ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

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

-- Los permisos se guardan contra el enum que ya existe, sin tabla de roles
-- aparte: los valores del enum son los roles.
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

-- Los hijos apuntan a su grupo
UPDATE sirve.menu h SET id_padre = (SELECT id FROM sirve.menu WHERE clave = 'catalogos')
 WHERE h.clave IN ('procesos','elecciones','municipios','distritos','secciones','casillas');

UPDATE sirve.menu h SET id_padre = (SELECT id FROM sirve.menu WHERE clave = 'captura')
 WHERE h.clave IN ('capturar','consultar');

UPDATE sirve.menu h SET id_padre = (SELECT id FROM sirve.menu WHERE clave = 'operacion')
 WHERE h.clave IN ('capturistas','usuarios');

UPDATE sirve.menu h SET id_padre = (SELECT id FROM sirve.menu WHERE clave = 'reportes')
 WHERE h.clave IN ('avance','asignacion','actas');

-- -------------------------------------------------- permisos por defecto
-- ADMIN ve todo, incluidos los usuarios.
INSERT INTO sirve.rol_menu (rol, id_menu)
SELECT 'ADMIN'::sirve.rol_usuario, id FROM sirve.menu
ON CONFLICT DO NOTHING;

-- COORDINADOR es el supervisor: todo menos administrar usuarios.
INSERT INTO sirve.rol_menu (rol, id_menu)
SELECT 'COORDINADOR'::sirve.rol_usuario, id FROM sirve.menu WHERE clave <> 'usuarios'
ON CONFLICT DO NOTHING;

-- OPERADOR es el capturista: capturar y consultar lo suyo.
INSERT INTO sirve.rol_menu (rol, id_menu)
SELECT 'OPERADOR'::sirve.rol_usuario, id FROM sirve.menu
 WHERE clave IN ('inicio','captura','capturar','consultar')
ON CONFLICT DO NOTHING;

-- ANALISTA y AUDITOR: solo lectura de reportes.
INSERT INTO sirve.rol_menu (rol, id_menu)
SELECT r::sirve.rol_usuario, m.id
  FROM unnest(ARRAY['ANALISTA','AUDITOR']) AS r
  CROSS JOIN sirve.menu m
 WHERE m.clave IN ('inicio','reportes','avance','asignacion','actas')
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------- permisos
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sirve_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON sirve.menu, sirve.rol_menu TO "User_app", sirve_app;
        GRANT USAGE, SELECT ON SEQUENCE sirve.menu_id_seq TO "User_app", sirve_app;
    ELSE
        GRANT SELECT, INSERT, UPDATE, DELETE ON sirve.menu, sirve.rol_menu TO "User_app";
        GRANT USAGE, SELECT ON SEQUENCE sirve.menu_id_seq TO "User_app";
    END IF;
END $$;

COMMIT;

-- El primer usuario lo crea la aplicación al arrancar, si la tabla está
-- vacía: usuario «admin» con la contraseña de ADMIN_CLAVE o, si no está
-- definida, una aleatoria que se escribe una sola vez en el registro.
