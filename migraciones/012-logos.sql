-- =====================================================================
-- SIRVE-P · Logos de partidos y coaliciones
-- ---------------------------------------------------------------------
-- El logo se guarda en la opción de boleta, que es lo que se dibuja: un
-- partido lo hereda de su catálogo y una coalición tiene el suyo.
--
-- Se guarda en la base y no en disco por tamaño y por respaldo: son veinte o
-- treinta imágenes de pocos kilobytes, y así viajan en el volcado sin depender
-- de un volumen aparte.
--
-- La restricción de tamaño real la pone la aplicación (512 KB); aquí solo se
-- comprueba que no se guarden imágenes vacías ni absurdamente grandes.
--
-- Ejecutar como postgres, en la base SIRVE.
-- =====================================================================

BEGIN;

ALTER TABLE sirve.partido
    ADD COLUMN IF NOT EXISTS logo bytea,
    ADD COLUMN IF NOT EXISTS logo_tipo text;

ALTER TABLE sirve.opcion_boleta
    ADD COLUMN IF NOT EXISTS logo bytea,
    ADD COLUMN IF NOT EXISTS logo_tipo text;

ALTER TABLE sirve.partido DROP CONSTRAINT IF EXISTS partido_logo_tamano_check;
ALTER TABLE sirve.partido
    ADD CONSTRAINT partido_logo_tamano_check
    CHECK (logo IS NULL OR octet_length(logo) <= 1048576);

ALTER TABLE sirve.opcion_boleta DROP CONSTRAINT IF EXISTS opcion_boleta_logo_tamano_check;
ALTER TABLE sirve.opcion_boleta
    ADD CONSTRAINT opcion_boleta_logo_tamano_check
    CHECK (logo IS NULL OR octet_length(logo) <= 1048576);

COMMIT;

-- Comprobación
SELECT p.clave, p.color,
       (p.logo IS NOT NULL) AS tiene_logo,
       octet_length(p.logo) AS bytes
  FROM sirve.partido p ORDER BY p.id;
