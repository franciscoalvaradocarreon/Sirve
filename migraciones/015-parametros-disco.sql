-- =====================================================================
-- SIRVE-P · Parámetros del aviso de disco
-- ---------------------------------------------------------------------
-- El umbral y el webhook se administran desde Parámetros, como el resto.
-- Sin webhook configurado el aviso solo queda en el registro del servidor.
--
-- Ejecutar como User_app en la base SIRVE.
-- =====================================================================

BEGIN;

INSERT INTO sirve.parametro (clave, valor, descripcion) VALUES
    ('disco.umbral', '80',
     'Porcentaje de disco ocupado a partir del cual se avisa.'),
    ('alerta.webhook', '',
     'Dirección a la que se manda el aviso (bot de Telegram o webhook propio). Vacía = solo registro.'),
    ('alerta.chat', '',
     'Identificador de chat para Telegram. Se deja vacío en un webhook genérico.')
ON CONFLICT (clave) DO NOTHING;

COMMIT;

SELECT clave, valor FROM sirve.parametro WHERE clave LIKE 'disco%' OR clave LIKE 'alerta%';