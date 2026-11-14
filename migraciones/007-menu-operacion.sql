-- =====================================================================
-- SIRVE-P · Menú del tablero de operación
-- ---------------------------------------------------------------------
-- Entrada nueva en Reportes, con los mismos roles que los demás reportes.
-- La sala de resultados no aparece aquí: es pública y se abre por dirección
-- (/sala), sin sesión.
--
-- Ejecutar como postgres (o el dueño del esquema), en la base SIRVE.
-- =====================================================================

BEGIN;

INSERT INTO sirve.menu (clave, etiqueta, ruta, icono, orden)
VALUES ('operacion-tablero', 'Operación', '/reportes/operacion', 'Gauge', 50)
ON CONFLICT (clave) DO NOTHING;

-- Cuelga del grupo Reportes.
UPDATE sirve.menu
   SET id_padre = (SELECT id FROM sirve.menu WHERE clave = 'reportes')
 WHERE clave = 'operacion-tablero';

-- Los mismos roles que ven reportes.
INSERT INTO sirve.rol_menu (rol, id_menu)
SELECT r::sirve.rol_usuario, m.id
  FROM unnest(ARRAY['ADMIN','COORDINADOR','ANALISTA','AUDITOR']) AS r
  CROSS JOIN sirve.menu m
 WHERE m.clave = 'operacion-tablero'
ON CONFLICT DO NOTHING;

COMMIT;

-- Comprobación
SELECT r.rol, m.etiqueta
  FROM sirve.rol_menu r
  JOIN sirve.menu m ON m.id = r.id_menu
 WHERE m.clave = 'operacion-tablero'
 ORDER BY r.rol;
