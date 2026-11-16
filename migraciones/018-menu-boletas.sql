-- =====================================================================
-- SIRVE-P · Entrada de menú para las boletas por elección
-- Ejecutar como User_app en la base SIRVE.
-- =====================================================================

BEGIN;

INSERT INTO sirve.menu (clave, etiqueta, ruta, icono, orden)
VALUES ('boletas', 'Boletas', '/catalogos/boletas', 'ListOrdered', 42)
ON CONFLICT (clave) DO NOTHING;

UPDATE sirve.menu
   SET id_padre = (SELECT id FROM sirve.menu WHERE clave = 'catalogos')
 WHERE clave = 'boletas';

INSERT INTO sirve.rol_menu (rol, id_menu)
SELECT r::sirve.rol_usuario, m.id
  FROM unnest(ARRAY['ADMIN','COORDINADOR']) AS r
  CROSS JOIN sirve.menu m
 WHERE m.clave = 'boletas'
ON CONFLICT DO NOTHING;

COMMIT;

SELECT r.rol, m.etiqueta FROM sirve.rol_menu r JOIN sirve.menu m ON m.id = r.id_menu
 WHERE m.clave = 'boletas' ORDER BY r.rol;