-- =====================================================================
-- SIRVE-P · Entrada de menú para el catálogo de partidos
-- ---------------------------------------------------------------------
-- La pantalla existe en /catalogos/partidos, pero el menú se arma con la
-- tabla menu y sus permisos por rol. Sin esta fila, nadie la ve.
--
-- Ejecutar como User_app en la base SIRVE.
-- =====================================================================

BEGIN;

INSERT INTO sirve.menu (clave, etiqueta, ruta, icono, orden)
VALUES ('partidos', 'Partidos', '/catalogos/partidos', 'Palette', 40)
ON CONFLICT (clave) DO NOTHING;

UPDATE sirve.menu
   SET id_padre = (SELECT id FROM sirve.menu WHERE clave = 'catalogos')
 WHERE clave = 'partidos';

-- Los mismos roles que administran catálogos.
INSERT INTO sirve.rol_menu (rol, id_menu)
SELECT r::sirve.rol_usuario, m.id
  FROM unnest(ARRAY['ADMIN','COORDINADOR']) AS r
  CROSS JOIN sirve.menu m
 WHERE m.clave = 'partidos'
ON CONFLICT DO NOTHING;

COMMIT;

SELECT r.rol, m.etiqueta
  FROM sirve.rol_menu r JOIN sirve.menu m ON m.id = r.id_menu
 WHERE m.clave = 'partidos' ORDER BY r.rol;