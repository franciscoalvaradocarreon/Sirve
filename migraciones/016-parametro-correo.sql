-- =====================================================================
-- SIRVE-P · Destinatarios del correo de avisos
-- ---------------------------------------------------------------------
-- Las credenciales del correo van en el .env, no aquí. Lo que sí se
-- administra desde la pantalla es a quién llegan los avisos.
--
-- Ejecutar como User_app en la base SIRVE.
-- =====================================================================

BEGIN;

INSERT INTO sirve.parametro (clave, valor, descripcion) VALUES
    ('alerta.correo', '',
     'Correos que reciben los avisos, separados por comas. Vacío = no se manda correo.')
ON CONFLICT (clave) DO NOTHING;

COMMIT;

SELECT clave, valor FROM sirve.parametro WHERE clave LIKE 'alerta%' ORDER BY clave;