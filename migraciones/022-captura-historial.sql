-- ============================================================================
-- 022 · Historial de capturas, con triggers
--
-- La captura es abierta a propósito: quien llega a la casilla captura, sin
-- restricción de asignación. Eso es operación, no un descuido.
--
-- Lo que faltaba es la traza, y se resuelve con triggers y no con código de la
-- aplicación por una razón concreta: un trigger no se puede saltar. Da igual si
-- la escritura viene de la aplicación, de DBeaver o de un psql a las tres de la
-- mañana: queda registrada. El código se puede olvidar; el trigger, no.
--
-- Quién hizo el cambio lo aporta la aplicación con set_config() dentro de la
-- transacción, que es lo único que el trigger no puede adivinar:
--
--     SELECT set_config('app.actor_usuario', '<uuid>', true),
--            set_config('app.actor_login',   '<usuario>', true),
--            set_config('app.actor_capturista', '<id>', true),
--            set_config('app.actor_dispositivo', '<id>', true),
--            set_config('app.ip', '<ip>', true),
--            set_config('app.agente', '<user agent>', true);
--
-- Si la escritura no pasa por la aplicación, el actor queda vacío y el cambio
-- se registra igual: eso también es información.
--
--     psql -U User_app -d SIRVE -f migraciones/022-captura-historial.sql
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Conversiones tolerantes
--
-- Si alguien escribe una IP o un uuid con basura, la captura NO debe fallar
-- por la traza. Estas funciones devuelven NULL en vez de lanzar el error.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sirve.a_uuid(valor text) RETURNS uuid AS $$
BEGIN
    RETURN nullif(valor, '')::uuid;
EXCEPTION WHEN others THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION sirve.a_inet(valor text) RETURNS inet AS $$
BEGIN
    RETURN nullif(valor, '')::inet;
EXCEPTION WHEN others THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION sirve.a_entero(valor text) RETURNS integer AS $$
BEGIN
    RETURN nullif(valor, '')::integer;
EXCEPTION WHEN others THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION sirve.a_texto(valor text) RETURNS text AS $$
BEGIN
    RETURN nullif(valor, '');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ---------------------------------------------------------------------------
-- 2. La tabla
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sirve.captura_historial (
    id                  bigserial PRIMARY KEY,

    id_captura          bigint      NOT NULL,
    id_casilla          integer     NOT NULL,
    id_eleccion         integer     NOT NULL,

    accion              text        NOT NULL
        CHECK (accion IN ('CREAR', 'REEMPLAZAR')),

    -- Quién: sesión de escritorio, teléfono, o nadie si vino por fuera.
    actor_usuario       uuid,
    actor_login         text,
    actor_capturista    integer,
    actor_dispositivo   integer,

    -- Desde dónde.
    ip                  inet,
    agente              text,

    -- Qué decía antes (cabecera y votos) y qué quedó.
    anterior            jsonb,
    nuevo               jsonb,

    ocurrido_en         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE sirve.captura_historial IS
    'Traza de cada captura y de cada reemplazo. La escriben triggers, no la aplicación.';
COMMENT ON COLUMN sirve.captura_historial.anterior IS
    'Cabecera anterior con sus votos. NULL en la primera captura.';

CREATE INDEX IF NOT EXISTS ix_captura_historial_casilla
    ON sirve.captura_historial (id_casilla, id_eleccion, ocurrido_en DESC);
CREATE INDEX IF NOT EXISTS ix_captura_historial_fecha
    ON sirve.captura_historial (ocurrido_en DESC);
CREATE INDEX IF NOT EXISTS ix_captura_historial_actor
    ON sirve.captura_historial (actor_login, ocurrido_en DESC);

-- ---------------------------------------------------------------------------
-- 3. Antes de guardar: completar ip, user_agent y capturada_por
--
-- Las tres columnas existen en la tabla y hasta hoy quedaban vacías cuando la
-- captura venía del escritorio. Se llenan aquí, el único punto por el que pasan
-- todas las escrituras.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sirve.captura_completar() RETURNS trigger AS $$
BEGIN
    IF NEW.ip IS NULL THEN
        NEW.ip := sirve.a_inet(current_setting('app.ip', true));
    END IF;

    IF NEW.user_agent IS NULL THEN
        NEW.user_agent := sirve.a_texto(current_setting('app.agente', true));
    END IF;

    IF NEW.capturada_por IS NULL THEN
        NEW.capturada_por := sirve.a_uuid(current_setting('app.actor_usuario', true));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_captura_completar ON sirve.captura;
CREATE TRIGGER tg_captura_completar
    BEFORE INSERT OR UPDATE ON sirve.captura
    FOR EACH ROW EXECUTE FUNCTION sirve.captura_completar();

-- ---------------------------------------------------------------------------
-- 4. Después de guardar: la constancia
--
-- En un reemplazo, los votos anteriores todavía están en la tabla: la
-- aplicación los borra y los vuelve a insertar después de esta escritura. Por
-- eso se guardan completos en el «anterior». Los nuevos no se copian aquí
-- porque en este instante todavía no existen.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sirve.captura_registrar() RETURNS trigger AS $$
DECLARE
    v_anterior jsonb;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        v_anterior := jsonb_build_object(
            'captura', to_jsonb(OLD),
            'votos', COALESCE(
                (SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id_opcion)
                   FROM sirve.captura_voto v
                  WHERE v.id_captura = OLD.id),
                '[]'::jsonb));
    END IF;

    INSERT INTO sirve.captura_historial
        (id_captura, id_casilla, id_eleccion, accion,
         actor_usuario, actor_login, actor_capturista, actor_dispositivo,
         ip, agente, anterior, nuevo)
    VALUES (
        NEW.id, NEW.id_casilla, NEW.id_eleccion,
        CASE WHEN TG_OP = 'INSERT' THEN 'CREAR' ELSE 'REEMPLAZAR' END,
        sirve.a_uuid(current_setting('app.actor_usuario', true)),
        sirve.a_texto(current_setting('app.actor_login', true)),
        sirve.a_entero(current_setting('app.actor_capturista', true)),
        sirve.a_entero(current_setting('app.actor_dispositivo', true)),
        NEW.ip, NEW.user_agent,
        v_anterior,
        jsonb_build_object('captura', to_jsonb(NEW)));

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_captura_registrar ON sirve.captura;
CREATE TRIGGER tg_captura_registrar
    AFTER INSERT OR UPDATE ON sirve.captura
    FOR EACH ROW EXECUTE FUNCTION sirve.captura_registrar();

-- ---------------------------------------------------------------------------
-- 5. Permisos para el rol de la aplicación
--
-- La aplicación escribe y lee la traza; nunca la modifica ni la borra. Si el
-- rol no existe todavía (una base nueva), se avisa y se sigue.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sirve_app') THEN
        GRANT SELECT, INSERT ON sirve.captura_historial TO sirve_app;
        GRANT USAGE, SELECT ON SEQUENCE sirve.captura_historial_id_seq TO sirve_app;
        RAISE NOTICE 'permisos concedidos a sirve_app';
    ELSE
        RAISE NOTICE 'el rol sirve_app no existe en esta base: se omite el GRANT';
    END IF;
END;
$$;

COMMIT;
