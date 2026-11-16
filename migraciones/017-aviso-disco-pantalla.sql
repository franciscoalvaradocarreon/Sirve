-- =====================================================================
-- SIRVE-P · Mostrar o no el aviso de disco en la aplicación
-- ---------------------------------------------------------------------
-- Apagado por omisión: el aviso va por correo. Se enciende si se quiere
-- además una franja en la parte superior del escritorio.
--
-- Ejecutar como User_app en la base SIRVE.
-- =====================================================================

BEGIN;

INSERT INTO sirve.parametro (clave, valor, descripcion) VALUES
    ('disco.aviso.pantalla', 'false',
     'Muestra la franja de aviso de disco en la aplicación. Apagado, el aviso solo va por correo o webhook.')
ON CONFLICT (clave) DO NOTHING;

COMMIT;

SELECT clave, valor FROM sirve.parametro WHERE clave LIKE 'disco%' ORDER BY clave;