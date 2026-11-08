-- =====================================================================
-- SIRVE-P · Esquema completo del MVP
-- ---------------------------------------------------------------------
-- Instalación desde cero. Crea el esquema `sirve` con las 14 tablas del
-- MVP, sus tipos, índices y la vista v_casilla.
--
-- NO incluye las tablas del modelo anterior (usuario, sesion_usuario,
-- acta_imagen, candidato, computo, computo_voto): no las usa la captura.
--
-- Después de este script, en orden:
--   01 a 22   catálogos (entidades, secciones, distritos, casillas…)
--   23, 24    diputación federal 2024
--   25        elecciones de 2027
--   26        vista (ya viene incluida aquí; el 26 es idempotente)
--   28        secciones oficiales de 2027
--   29 a 32   domicilios y coordenadas
--
-- Sin funciones ni disparadores: solo tablas, llaves y restricciones.
--
-- Nota: captura.capturada_por queda como uuid suelto, sin llave foránea a
-- sirve.usuario. Esa tabla es del modelo anterior y el MVP no tiene
-- autenticación (decisión D-11). Cuando se agregue, se crea la tabla y la
-- llave; el campo ya está listo.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS sirve;

CREATE TYPE sirve.estado_proceso AS ENUM ('PLANEACION', 'JORNADA', 'CERRADO');
CREATE TYPE sirve.tipo_distrito AS ENUM ('FEDERAL', 'LOCAL', 'MUNICIPAL');
CREATE TYPE sirve.tipo_eleccion AS ENUM ('PRESIDENCIA', 'GOBERNATURA', 'SENADURIA', 'DIPUTACION_FEDERAL', 'DIPUTACION_LOCAL', 'PRESIDENCIA_MUNICIPAL', 'OTRO');
CREATE TYPE sirve.tipo_opcion AS ENUM ('PARTIDO', 'COALICION', 'INDEPENDIENTE');
CREATE TYPE sirve.estado_captura AS ENUM ('BORRADOR', 'EN_COLA', 'RECIBIDA', 'VIGENTE', 'REEMPLAZADA', 'ANULADA');
CREATE TYPE sirve.origen_captura AS ENUM ('APP', 'PORTAL', 'IMPORTACION');

-- PostgreSQL database dump

\restrict MQzzVgrfxW0pVosWYWuaTv3EN5cWkVK7n6r84rFmZDMpanglX8F29ypAQKdSeTx

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;


-- Name: captura; Type: TABLE; Schema: sirve; Owner: -

CREATE TABLE sirve.captura (
    id bigint NOT NULL,
    id_cliente uuid NOT NULL,
    id_casilla integer NOT NULL,
    id_eleccion integer NOT NULL,
    estado sirve.estado_captura DEFAULT 'VIGENTE'::sirve.estado_captura NOT NULL,
    origen sirve.origen_captura DEFAULT 'APP'::sirve.origen_captura NOT NULL,
    total_acta integer NOT NULL,
    no_registrados integer DEFAULT 0 NOT NULL,
    nulos integer DEFAULT 0 NOT NULL,
    suma_opciones integer DEFAULT 0 NOT NULL,
    votos_validos integer GENERATED ALWAYS AS ((total_acta - nulos)) STORED,
    diferencia integer GENERATED ALWAYS AS ((total_acta - ((suma_opciones + no_registrados) + nulos))) STORED,
    aritmetica_ok boolean GENERATED ALWAYS AS ((total_acta = ((suma_opciones + no_registrados) + nulos))) STORED,
    motivo_inconsistencia text,
    autor_texto text,
    ip inet,
    user_agent text,
    hora_cliente timestamp with time zone,
    recibida_en timestamp with time zone DEFAULT now() NOT NULL,
    vigente_desde timestamp with time zone,
    vigente_hasta timestamp with time zone,
    reemplaza_a bigint,
    capturada_por uuid,
    motivo text,
    CONSTRAINT captura_no_registrados_check CHECK ((no_registrados >= 0)),
    CONSTRAINT captura_nulos_check CHECK ((nulos >= 0)),
    CONSTRAINT captura_suma_opciones_check CHECK ((suma_opciones >= 0)),
    CONSTRAINT captura_total_acta_check CHECK ((total_acta >= 0)),
    CONSTRAINT ck_captura_anulada CHECK (((estado <> 'ANULADA'::sirve.estado_captura) OR (motivo IS NOT NULL))),
    CONSTRAINT ck_captura_nulos CHECK ((nulos <= total_acta))
);



-- Name: captura_id_seq; Type: SEQUENCE; Schema: sirve; Owner: -

ALTER TABLE sirve.captura ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME sirve.captura_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



-- Name: captura_voto; Type: TABLE; Schema: sirve; Owner: -

CREATE TABLE sirve.captura_voto (
    id bigint NOT NULL,
    id_captura bigint NOT NULL,
    id_opcion integer NOT NULL,
    votos integer NOT NULL,
    CONSTRAINT captura_voto_votos_check CHECK ((votos >= 0))
);



-- Name: captura_voto_id_seq; Type: SEQUENCE; Schema: sirve; Owner: -

ALTER TABLE sirve.captura_voto ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME sirve.captura_voto_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



-- Name: casilla; Type: TABLE; Schema: sirve; Owner: -

CREATE TABLE sirve.casilla (
    id integer NOT NULL,
    id_seccion integer NOT NULL,
    -- Distrito local de la casilla. Columna heredada del modelo anterior:
    -- el script 19 la copia a seccion y la elimina, porque el distrito
    -- pertenece a la sección y no a la casilla. Existe aquí para que los
    -- scripts 11 y 12 puedan cargar el dato desde los libros.
    id_distrito integer,
    clave text NOT NULL,
    tipo text NOT NULL,
    direccion text,
    activa boolean DEFAULT true NOT NULL,
    ubicacion text,
    referencia text
);



-- Name: casilla_eleccion; Type: TABLE; Schema: sirve; Owner: -

CREATE TABLE sirve.casilla_eleccion (
    id_casilla integer NOT NULL,
    id_eleccion integer NOT NULL
);



-- Name: casilla_id_seq; Type: SEQUENCE; Schema: sirve; Owner: -

ALTER TABLE sirve.casilla ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME sirve.casilla_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



-- Name: coalicion; Type: TABLE; Schema: sirve; Owner: -

CREATE TABLE sirve.coalicion (
    id integer NOT NULL,
    id_proceso integer NOT NULL,
    clave text NOT NULL,
    nombre text NOT NULL,
    activa boolean DEFAULT true NOT NULL
);



-- Name: coalicion_id_seq; Type: SEQUENCE; Schema: sirve; Owner: -

ALTER TABLE sirve.coalicion ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME sirve.coalicion_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



-- Name: coalicion_partido; Type: TABLE; Schema: sirve; Owner: -

CREATE TABLE sirve.coalicion_partido (
    id_coalicion integer NOT NULL,
    id_partido integer NOT NULL
);



-- Name: distrito; Type: TABLE; Schema: sirve; Owner: -

CREATE TABLE sirve.distrito (
    id integer NOT NULL,
    id_entidad integer NOT NULL,
    tipo sirve.tipo_distrito NOT NULL,
    clave text NOT NULL,
    nombre text NOT NULL
);



-- Name: distrito_id_seq; Type: SEQUENCE; Schema: sirve; Owner: -

ALTER TABLE sirve.distrito ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME sirve.distrito_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



-- Name: eleccion; Type: TABLE; Schema: sirve; Owner: -

CREATE TABLE sirve.eleccion (
    id integer NOT NULL,
    id_proceso integer NOT NULL,
    clave text NOT NULL,
    nombre text NOT NULL,
    tipo sirve.tipo_eleccion NOT NULL,
    orden smallint NOT NULL,
    capturable boolean DEFAULT true NOT NULL,
    activa boolean DEFAULT true NOT NULL
);



-- Name: eleccion_id_seq; Type: SEQUENCE; Schema: sirve; Owner: -

ALTER TABLE sirve.eleccion ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME sirve.eleccion_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



-- Name: entidad; Type: TABLE; Schema: sirve; Owner: -

CREATE TABLE sirve.entidad (
    id integer NOT NULL,
    clave character(2) NOT NULL,
    nombre_corto text NOT NULL,
    nombre text NOT NULL,
    activo boolean DEFAULT true NOT NULL
);



-- Name: entidad_id_seq; Type: SEQUENCE; Schema: sirve; Owner: -

ALTER TABLE sirve.entidad ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME sirve.entidad_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



-- Name: municipio; Type: TABLE; Schema: sirve; Owner: -

CREATE TABLE sirve.municipio (
    id integer NOT NULL,
    id_entidad integer NOT NULL,
    clave text NOT NULL,
    nombre text NOT NULL
);



-- Name: municipio_id_seq; Type: SEQUENCE; Schema: sirve; Owner: -

ALTER TABLE sirve.municipio ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME sirve.municipio_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



-- Name: opcion_boleta; Type: TABLE; Schema: sirve; Owner: -

CREATE TABLE sirve.opcion_boleta (
    id integer NOT NULL,
    id_eleccion integer NOT NULL,
    tipo sirve.tipo_opcion NOT NULL,
    id_partido integer,
    id_coalicion integer,
    etiqueta text NOT NULL,
    orden smallint NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    CONSTRAINT ck_opcion_referencia CHECK ((((tipo = 'PARTIDO'::sirve.tipo_opcion) AND (id_partido IS NOT NULL) AND (id_coalicion IS NULL)) OR ((tipo = 'COALICION'::sirve.tipo_opcion) AND (id_coalicion IS NOT NULL) AND (id_partido IS NULL)) OR ((tipo = 'INDEPENDIENTE'::sirve.tipo_opcion) AND (id_partido IS NULL) AND (id_coalicion IS NULL))))
);



-- Name: opcion_boleta_id_seq; Type: SEQUENCE; Schema: sirve; Owner: -

ALTER TABLE sirve.opcion_boleta ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME sirve.opcion_boleta_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



-- Name: partido; Type: TABLE; Schema: sirve; Owner: -

CREATE TABLE sirve.partido (
    id integer NOT NULL,
    clave text NOT NULL,
    nombre text NOT NULL,
    color text,
    orden smallint DEFAULT 0 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    CONSTRAINT partido_color_check CHECK ((color ~ '^#[0-9A-Fa-f]{6}$'::text))
);



-- Name: partido_id_seq; Type: SEQUENCE; Schema: sirve; Owner: -

ALTER TABLE sirve.partido ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME sirve.partido_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



-- Name: proceso_electoral; Type: TABLE; Schema: sirve; Owner: -

CREATE TABLE sirve.proceso_electoral (
    id integer NOT NULL,
    nombre text NOT NULL,
    anio smallint NOT NULL,
    fecha_jornada date,
    estado sirve.estado_proceso DEFAULT 'PLANEACION'::sirve.estado_proceso NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    id_entidad integer,
    CONSTRAINT proceso_electoral_anio_check CHECK (((anio >= 2000) AND (anio <= 2100)))
);



-- Name: proceso_electoral_id_seq; Type: SEQUENCE; Schema: sirve; Owner: -

ALTER TABLE sirve.proceso_electoral ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME sirve.proceso_electoral_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



-- Name: seccion; Type: TABLE; Schema: sirve; Owner: -

CREATE TABLE sirve.seccion (
    id integer NOT NULL,
    id_municipio integer NOT NULL,
    clave text NOT NULL,
    lista_nominal integer,
    id_proceso integer NOT NULL,
    id_distrito_local integer,
    id_distrito_federal integer,
    CONSTRAINT seccion_lista_nominal_check CHECK ((lista_nominal >= 0))
);



-- Name: seccion_id_seq; Type: SEQUENCE; Schema: sirve; Owner: -

ALTER TABLE sirve.seccion ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME sirve.seccion_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



-- Name: v_casilla; Type: VIEW; Schema: sirve; Owner: -

CREATE VIEW sirve.v_casilla AS
 SELECT k.id,
    k.clave,
    k.tipo,
    k.activa,
    k.direccion,
    s.id AS id_seccion,
    s.clave AS seccion,
    p.id AS id_proceso,
    p.anio,
    e.id AS id_entidad,
    e.clave AS entidad_clave,
    e.nombre AS entidad,
    m.id AS id_municipio,
    m.clave AS municipio_clave,
    m.nombre AS municipio,
    s.id_distrito_local,
    dl.clave AS distrito_local,
    dl.nombre AS distrito_local_nombre,
    s.id_distrito_federal,
    df.clave AS distrito_federal,
    df.nombre AS distrito_federal_nombre
   FROM ((((((sirve.casilla k
     JOIN sirve.seccion s ON ((s.id = k.id_seccion)))
     JOIN sirve.proceso_electoral p ON ((p.id = s.id_proceso)))
     JOIN sirve.entidad e ON ((e.id = p.id_entidad)))
     JOIN sirve.municipio m ON ((m.id = s.id_municipio)))
     LEFT JOIN sirve.distrito dl ON ((dl.id = s.id_distrito_local)))
     LEFT JOIN sirve.distrito df ON ((df.id = s.id_distrito_federal)));



-- Name: captura captura_id_cliente_key; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.captura
    ADD CONSTRAINT captura_id_cliente_key UNIQUE (id_cliente);



-- Name: captura captura_pkey; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.captura
    ADD CONSTRAINT captura_pkey PRIMARY KEY (id);



-- Name: captura_voto captura_voto_id_captura_id_opcion_key; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.captura_voto
    ADD CONSTRAINT captura_voto_id_captura_id_opcion_key UNIQUE (id_captura, id_opcion);



-- Name: captura_voto captura_voto_pkey; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.captura_voto
    ADD CONSTRAINT captura_voto_pkey PRIMARY KEY (id);



-- Name: casilla casilla_clave_key; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.casilla
    ADD CONSTRAINT casilla_clave_key UNIQUE (clave);



-- Name: casilla_eleccion casilla_eleccion_pkey; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.casilla_eleccion
    ADD CONSTRAINT casilla_eleccion_pkey PRIMARY KEY (id_casilla, id_eleccion);



-- Name: casilla casilla_pkey; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.casilla
    ADD CONSTRAINT casilla_pkey PRIMARY KEY (id);



-- Name: coalicion coalicion_id_proceso_clave_key; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.coalicion
    ADD CONSTRAINT coalicion_id_proceso_clave_key UNIQUE (id_proceso, clave);



-- Name: coalicion_partido coalicion_partido_pkey; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.coalicion_partido
    ADD CONSTRAINT coalicion_partido_pkey PRIMARY KEY (id_coalicion, id_partido);



-- Name: coalicion coalicion_pkey; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.coalicion
    ADD CONSTRAINT coalicion_pkey PRIMARY KEY (id);



-- Name: distrito distrito_id_entidad_tipo_clave_key; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.distrito
    ADD CONSTRAINT distrito_id_entidad_tipo_clave_key UNIQUE (id_entidad, tipo, clave);



-- Name: distrito distrito_pkey; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.distrito
    ADD CONSTRAINT distrito_pkey PRIMARY KEY (id);



-- Name: eleccion eleccion_id_proceso_clave_key; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.eleccion
    ADD CONSTRAINT eleccion_id_proceso_clave_key UNIQUE (id_proceso, clave);



-- Name: eleccion eleccion_id_proceso_orden_key; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.eleccion
    ADD CONSTRAINT eleccion_id_proceso_orden_key UNIQUE (id_proceso, orden);



-- Name: eleccion eleccion_pkey; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.eleccion
    ADD CONSTRAINT eleccion_pkey PRIMARY KEY (id);



-- Name: entidad entidad_clave_key; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.entidad
    ADD CONSTRAINT entidad_clave_key UNIQUE (clave);



-- Name: entidad entidad_nombre_corto_key; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.entidad
    ADD CONSTRAINT entidad_nombre_corto_key UNIQUE (nombre_corto);



-- Name: entidad entidad_nombre_key; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.entidad
    ADD CONSTRAINT entidad_nombre_key UNIQUE (nombre);



-- Name: entidad entidad_pkey; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.entidad
    ADD CONSTRAINT entidad_pkey PRIMARY KEY (id);



-- Name: municipio municipio_id_entidad_clave_key; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.municipio
    ADD CONSTRAINT municipio_id_entidad_clave_key UNIQUE (id_entidad, clave);



-- Name: municipio municipio_pkey; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.municipio
    ADD CONSTRAINT municipio_pkey PRIMARY KEY (id);



-- Name: opcion_boleta opcion_boleta_id_eleccion_orden_key; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.opcion_boleta
    ADD CONSTRAINT opcion_boleta_id_eleccion_orden_key UNIQUE (id_eleccion, orden);



-- Name: opcion_boleta opcion_boleta_pkey; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.opcion_boleta
    ADD CONSTRAINT opcion_boleta_pkey PRIMARY KEY (id);



-- Name: partido partido_clave_key; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.partido
    ADD CONSTRAINT partido_clave_key UNIQUE (clave);



-- Name: partido partido_pkey; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.partido
    ADD CONSTRAINT partido_pkey PRIMARY KEY (id);



-- Name: proceso_electoral proceso_electoral_pkey; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.proceso_electoral
    ADD CONSTRAINT proceso_electoral_pkey PRIMARY KEY (id);



-- Name: seccion seccion_pkey; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.seccion
    ADD CONSTRAINT seccion_pkey PRIMARY KEY (id);



-- Name: captura ux_captura_casilla_eleccion; Type: CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.captura
    ADD CONSTRAINT ux_captura_casilla_eleccion UNIQUE (id_casilla, id_eleccion);



-- Name: ix_captura_casilla; Type: INDEX; Schema: sirve; Owner: -

CREATE INDEX ix_captura_casilla ON sirve.captura USING btree (id_casilla, id_eleccion, recibida_en DESC);



-- Name: ix_captura_pendiente; Type: INDEX; Schema: sirve; Owner: -

CREATE INDEX ix_captura_pendiente ON sirve.captura USING btree (recibida_en) WHERE (estado = 'RECIBIDA'::sirve.estado_captura);



-- Name: ix_captura_voto_opcion; Type: INDEX; Schema: sirve; Owner: -

CREATE INDEX ix_captura_voto_opcion ON sirve.captura_voto USING btree (id_opcion);



-- Name: ix_casilla_eleccion_eleccion; Type: INDEX; Schema: sirve; Owner: -

CREATE INDEX ix_casilla_eleccion_eleccion ON sirve.casilla_eleccion USING btree (id_eleccion);



-- Name: ix_casilla_seccion; Type: INDEX; Schema: sirve; Owner: -

CREATE INDEX ix_casilla_seccion ON sirve.casilla USING btree (id_seccion);



-- Name: ix_opcion_eleccion; Type: INDEX; Schema: sirve; Owner: -

CREATE INDEX ix_opcion_eleccion ON sirve.opcion_boleta USING btree (id_eleccion, orden) WHERE activo;



-- Name: ux_captura_vigente; Type: INDEX; Schema: sirve; Owner: -

CREATE UNIQUE INDEX ux_captura_vigente ON sirve.captura USING btree (id_casilla, id_eleccion) WHERE (estado = 'VIGENTE'::sirve.estado_captura);



-- Name: ux_proceso_activo_entidad; Type: INDEX; Schema: sirve; Owner: -

CREATE UNIQUE INDEX ux_proceso_activo_entidad ON sirve.proceso_electoral USING btree (id_entidad) WHERE activo;



-- Name: ux_proceso_entidad_anio; Type: INDEX; Schema: sirve; Owner: -

CREATE UNIQUE INDEX ux_proceso_entidad_anio ON sirve.proceso_electoral USING btree (id_entidad, anio);



-- Name: ux_seccion_proceso_municipio_clave; Type: INDEX; Schema: sirve; Owner: -

CREATE UNIQUE INDEX ux_seccion_proceso_municipio_clave ON sirve.seccion USING btree (id_proceso, id_municipio, clave);




-- Name: captura captura_id_casilla_fkey; Type: FK CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.captura
    ADD CONSTRAINT captura_id_casilla_fkey FOREIGN KEY (id_casilla) REFERENCES sirve.casilla(id);



-- Name: captura captura_id_eleccion_fkey; Type: FK CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.captura
    ADD CONSTRAINT captura_id_eleccion_fkey FOREIGN KEY (id_eleccion) REFERENCES sirve.eleccion(id);



-- Name: captura captura_reemplaza_a_fkey; Type: FK CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.captura
    ADD CONSTRAINT captura_reemplaza_a_fkey FOREIGN KEY (reemplaza_a) REFERENCES sirve.captura(id);



-- Name: captura_voto captura_voto_id_captura_fkey; Type: FK CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.captura_voto
    ADD CONSTRAINT captura_voto_id_captura_fkey FOREIGN KEY (id_captura) REFERENCES sirve.captura(id);



-- Name: captura_voto captura_voto_id_opcion_fkey; Type: FK CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.captura_voto
    ADD CONSTRAINT captura_voto_id_opcion_fkey FOREIGN KEY (id_opcion) REFERENCES sirve.opcion_boleta(id);



-- Name: casilla_eleccion casilla_eleccion_id_casilla_fkey; Type: FK CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.casilla_eleccion
    ADD CONSTRAINT casilla_eleccion_id_casilla_fkey FOREIGN KEY (id_casilla) REFERENCES sirve.casilla(id) ON DELETE CASCADE;



-- Name: casilla_eleccion casilla_eleccion_id_eleccion_fkey; Type: FK CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.casilla_eleccion
    ADD CONSTRAINT casilla_eleccion_id_eleccion_fkey FOREIGN KEY (id_eleccion) REFERENCES sirve.eleccion(id) ON DELETE CASCADE;



-- Name: casilla casilla_id_seccion_fkey; Type: FK CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.casilla
    ADD CONSTRAINT casilla_id_seccion_fkey FOREIGN KEY (id_seccion) REFERENCES sirve.seccion(id);



-- Name: coalicion coalicion_id_proceso_fkey; Type: FK CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.coalicion
    ADD CONSTRAINT coalicion_id_proceso_fkey FOREIGN KEY (id_proceso) REFERENCES sirve.proceso_electoral(id);



-- Name: coalicion_partido coalicion_partido_id_coalicion_fkey; Type: FK CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.coalicion_partido
    ADD CONSTRAINT coalicion_partido_id_coalicion_fkey FOREIGN KEY (id_coalicion) REFERENCES sirve.coalicion(id) ON DELETE CASCADE;



-- Name: coalicion_partido coalicion_partido_id_partido_fkey; Type: FK CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.coalicion_partido
    ADD CONSTRAINT coalicion_partido_id_partido_fkey FOREIGN KEY (id_partido) REFERENCES sirve.partido(id);



-- Name: distrito distrito_id_entidad_fkey; Type: FK CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.distrito
    ADD CONSTRAINT distrito_id_entidad_fkey FOREIGN KEY (id_entidad) REFERENCES sirve.entidad(id);



-- Name: eleccion eleccion_id_proceso_fkey; Type: FK CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.eleccion
    ADD CONSTRAINT eleccion_id_proceso_fkey FOREIGN KEY (id_proceso) REFERENCES sirve.proceso_electoral(id);



-- Name: captura fk_captura_casilla_eleccion; Type: FK CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.captura
    ADD CONSTRAINT fk_captura_casilla_eleccion FOREIGN KEY (id_casilla, id_eleccion) REFERENCES sirve.casilla_eleccion(id_casilla, id_eleccion);



-- Name: proceso_electoral fk_proceso_entidad; Type: FK CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.proceso_electoral
    ADD CONSTRAINT fk_proceso_entidad FOREIGN KEY (id_entidad) REFERENCES sirve.entidad(id);



-- Name: seccion fk_seccion_distrito_federal; Type: FK CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.seccion
    ADD CONSTRAINT fk_seccion_distrito_federal FOREIGN KEY (id_distrito_federal) REFERENCES sirve.distrito(id);



-- Name: seccion fk_seccion_distrito_local; Type: FK CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.seccion
    ADD CONSTRAINT fk_seccion_distrito_local FOREIGN KEY (id_distrito_local) REFERENCES sirve.distrito(id);



-- Name: seccion fk_seccion_proceso; Type: FK CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.seccion
    ADD CONSTRAINT fk_seccion_proceso FOREIGN KEY (id_proceso) REFERENCES sirve.proceso_electoral(id);



-- Name: municipio municipio_id_entidad_fkey; Type: FK CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.municipio
    ADD CONSTRAINT municipio_id_entidad_fkey FOREIGN KEY (id_entidad) REFERENCES sirve.entidad(id);



-- Name: opcion_boleta opcion_boleta_id_coalicion_fkey; Type: FK CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.opcion_boleta
    ADD CONSTRAINT opcion_boleta_id_coalicion_fkey FOREIGN KEY (id_coalicion) REFERENCES sirve.coalicion(id);



-- Name: opcion_boleta opcion_boleta_id_eleccion_fkey; Type: FK CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.opcion_boleta
    ADD CONSTRAINT opcion_boleta_id_eleccion_fkey FOREIGN KEY (id_eleccion) REFERENCES sirve.eleccion(id);



-- Name: opcion_boleta opcion_boleta_id_partido_fkey; Type: FK CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.opcion_boleta
    ADD CONSTRAINT opcion_boleta_id_partido_fkey FOREIGN KEY (id_partido) REFERENCES sirve.partido(id);



-- Name: seccion seccion_id_municipio_fkey; Type: FK CONSTRAINT; Schema: sirve; Owner: -

ALTER TABLE ONLY sirve.seccion
    ADD CONSTRAINT seccion_id_municipio_fkey FOREIGN KEY (id_municipio) REFERENCES sirve.municipio(id);



-- PostgreSQL database dump complete

\unrestrict MQzzVgrfxW0pVosWYWuaTv3EN5cWkVK7n6r84rFmZDMpanglX8F29ypAQKdSeTx


-- =====================================================================
-- Permisos para la aplicación
-- ---------------------------------------------------------------------
-- El rol sirve_app solo puede leer y escribir datos: nada de DDL.
-- El rol sirve_lectura sirve para el portal y las consultas de solo lectura.
-- =====================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sirve_app') THEN
        GRANT USAGE ON SCHEMA sirve TO sirve_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sirve TO sirve_app;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sirve TO sirve_app;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sirve_lectura') THEN
        GRANT USAGE ON SCHEMA sirve TO sirve_lectura;
        GRANT SELECT ON ALL TABLES IN SCHEMA sirve TO sirve_lectura;
    END IF;
END $$;

-- =====================================================================
-- Coordenadas de la casilla
-- ---------------------------------------------------------------------
-- Van vacías en la instalación; las llena el script 31 con lo que se
-- geocodificó. Se declaran aquí para que el esquema quede completo y la
-- aplicación pueda pedirlas sin depender de que el 31 ya haya corrido.
-- =====================================================================

ALTER TABLE sirve.casilla ADD COLUMN IF NOT EXISTS latitud       numeric(9,6);
ALTER TABLE sirve.casilla ADD COLUMN IF NOT EXISTS longitud      numeric(9,6);
ALTER TABLE sirve.casilla ADD COLUMN IF NOT EXISTS geo_precision text;
ALTER TABLE sirve.casilla ADD COLUMN IF NOT EXISTS geo_fuente    text;
