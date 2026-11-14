-- =====================================================================
-- SIRVE-P · Caducidad de los códigos de enrolamiento
-- ---------------------------------------------------------------------
-- Un código valía para siempre: si se mandaba por WhatsApp y nadie lo abría,
-- seguía sirviendo meses después. Ahora vale un día.
--
-- Los códigos pendientes que ya existen se dan por vencidos pronto: se les
-- pone un día desde ahora, para que nadie quede con un código eterno por el
-- simple hecho de haberlo generado antes del cambio.
--
-- Ejecutar como postgres (o el dueño del esquema), en la base SIRVE.
-- =====================================================================

BEGIN;

ALTER TABLE sirve.dispositivo
    ADD COLUMN IF NOT EXISTS codigo_expira timestamptz;

COMMENT ON COLUMN sirve.dispositivo.codigo_expira IS
    'Hasta cuándo sirve el código. En la base solo está su hash.';

-- Los que ya estaban pendientes: un día desde ahora.
UPDATE sirve.dispositivo
   SET codigo_expira = now() + interval '1 day'
 WHERE pase_hash IS NULL
   AND codigo_hash IS NOT NULL
   AND codigo_expira IS NULL;

COMMIT;
