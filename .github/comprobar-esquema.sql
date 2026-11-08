-- =====================================================================
-- SIRVE-P · Comprobación del esquema
-- ---------------------------------------------------------------------
-- Se ejecuta en el CI después de aplicar todos los scripts de db/ sobre una
-- base vacía. Si algo se rompió en la secuencia de instalación, esto lo dice
-- con un mensaje concreto en lugar de fallar más adelante en producción.
--
-- Cualquier consulta que devuelva una fila hace fallar el trabajo.
-- =====================================================================

\set ON_ERROR_STOP on
\echo 'Comprobando el esquema instalado…'

-- 1. Las tablas del MVP existen
DO $$
DECLARE
    faltan text;
BEGIN
    SELECT string_agg(t.nombre, ', ')
      INTO faltan
      FROM (VALUES ('entidad'),('municipio'),('proceso_electoral'),('distrito'),
                   ('seccion'),('eleccion'),('casilla'),('casilla_eleccion'),
                   ('partido'),('coalicion'),('coalicion_partido'),
                   ('opcion_boleta'),('captura'),('captura_voto')) AS t(nombre)
     WHERE to_regclass('sirve.' || t.nombre) IS NULL;

    IF faltan IS NOT NULL THEN
        RAISE EXCEPTION 'Faltan tablas: %', faltan;
    END IF;
    RAISE NOTICE 'Las 14 tablas existen.';
END $$;

-- 2. La vista está
DO $$
BEGIN
    IF to_regclass('sirve.v_casilla') IS NULL THEN
        RAISE EXCEPTION 'Falta la vista sirve.v_casilla';
    END IF;
    RAISE NOTICE 'La vista v_casilla existe.';
END $$;

-- 3. Los catálogos traen lo que deben
DO $$
DECLARE
    n_entidad    integer; n_municipio integer; n_proceso  integer;
    n_seccion    integer; n_casilla   integer; n_eleccion integer;
    n_opcion     integer;
BEGIN
    SELECT count(*) INTO n_entidad   FROM sirve.entidad;
    SELECT count(*) INTO n_municipio FROM sirve.municipio;
    SELECT count(*) INTO n_proceso   FROM sirve.proceso_electoral;
    SELECT count(*) INTO n_seccion   FROM sirve.seccion;
    SELECT count(*) INTO n_casilla   FROM sirve.casilla;
    SELECT count(*) INTO n_eleccion  FROM sirve.eleccion;
    SELECT count(*) INTO n_opcion    FROM sirve.opcion_boleta;

    RAISE NOTICE 'entidad % · municipio % · proceso % · sección % · casilla % · elección % · opción %',
        n_entidad, n_municipio, n_proceso, n_seccion, n_casilla, n_eleccion, n_opcion;

    IF n_entidad   <> 32 THEN RAISE EXCEPTION 'entidad: se esperaban 32, hay %', n_entidad; END IF;
    IF n_municipio <> 51 THEN RAISE EXCEPTION 'municipio: se esperaban 51, hay %', n_municipio; END IF;
    IF n_proceso   <> 3  THEN RAISE EXCEPTION 'proceso: se esperaban 3, hay %', n_proceso; END IF;
    IF n_casilla   < 20000 THEN RAISE EXCEPTION 'casilla: se esperaban más de 20 000, hay %', n_casilla; END IF;
    IF n_eleccion  < 9  THEN RAISE EXCEPTION 'elección: se esperaban al menos 9, hay %', n_eleccion; END IF;
    IF n_opcion    < 100 THEN RAISE EXCEPTION 'opción de boleta: se esperaban al menos 100, hay %', n_opcion; END IF;
END $$;

-- 4. Ninguna sección sin municipio ni proceso
DO $$
DECLARE huerfanas integer;
BEGIN
    SELECT count(*) INTO huerfanas
      FROM sirve.seccion s
     WHERE s.id_proceso IS NULL OR s.id_municipio IS NULL;
    IF huerfanas > 0 THEN
        RAISE EXCEPTION 'Hay % secciones sin proceso o sin municipio', huerfanas;
    END IF;
END $$;

-- 5. Ninguna casilla declarada fuera de su proceso
DO $$
DECLARE cruzadas integer;
BEGIN
    SELECT count(*) INTO cruzadas
      FROM sirve.casilla_eleccion ce
      JOIN sirve.casilla k ON k.id = ce.id_casilla
      JOIN sirve.seccion s ON s.id = k.id_seccion
      JOIN sirve.eleccion e ON e.id = ce.id_eleccion
     WHERE s.id_proceso <> e.id_proceso;
    IF cruzadas > 0 THEN
        RAISE EXCEPTION 'Hay % casillas ligadas a una elección de otro proceso', cruzadas;
    END IF;
    RAISE NOTICE 'La pertenencia casilla-elección no cruza procesos.';
END $$;

-- 6. La captura rechaza una casilla que no aplica a la elección
DO $$
DECLARE
    id_casilla integer;
    id_eleccion integer;
    rechazada boolean := false;
BEGIN
    -- Una casilla de 2021 y una elección de 2024 no pueden convivir.
    SELECT k.id INTO id_casilla FROM sirve.casilla k
      JOIN sirve.seccion s ON s.id = k.id_seccion
      JOIN sirve.proceso_electoral p ON p.id = s.id_proceso
     WHERE p.anio = 2021 LIMIT 1;

    SELECT e.id INTO id_eleccion FROM sirve.eleccion e
      JOIN sirve.proceso_electoral p ON p.id = e.id_proceso
     WHERE p.anio = 2024 LIMIT 1;

    BEGIN
        INSERT INTO sirve.captura (id_cliente, id_casilla, id_eleccion,
                                   total_acta, suma_opciones)
        VALUES (gen_random_uuid(), id_casilla, id_eleccion, 1, 1);
    EXCEPTION
        WHEN foreign_key_violation THEN rechazada := true;
    END;

    IF NOT rechazada THEN
        RAISE EXCEPTION 'La base aceptó una captura en una casilla que no aplica';
    END IF;
    RAISE NOTICE 'La llave compuesta rechaza la casilla que no aplica.';
END $$;

\echo 'El esquema pasó todas las comprobaciones.'
