-- =====================================================================
-- SIRVE-P · Rol REPRESENTANTE
-- ---------------------------------------------------------------------
-- Un representante de partido en casilla: observa y verifica, no captura ni
-- administra. Ve la galería de actas y los reportes de avance.
--
-- Dos cosas importantes de este script:
--
-- · Un valor nuevo en un enum se agrega con ALTER TYPE, y PostgreSQL no deja
--   usarlo en la misma transacción en que se crea. Por eso las sentencias van
--   sueltas, sin BEGIN ni COMMIT: primero se agrega el valor y, ya registrado,
--   se conceden los menús.
--
-- · Es idempotente: si el rol ya existe, no hace nada.
--
-- Ejecutar como postgres, en la base SIRVE. Y ejecutarlo dos veces si la
-- primera falla a la mitad: la segunda corrida completa lo que falte.
-- =====================================================================

-- 1) El rol en el enum.
ALTER TYPE sirve.rol_usuario ADD VALUE IF NOT EXISTS 'REPRESENTANTE';

-- 2) Sus menús: inicio y los reportes que puede consultar.
INSERT INTO sirve.rol_menu (rol, id_menu)
SELECT 'REPRESENTANTE'::sirve.rol_usuario, m.id
  FROM sirve.menu m
 WHERE m.clave IN ('inicio', 'reportes', 'avance', 'actas')
ON CONFLICT DO NOTHING;

-- Comprobación
SELECT r.rol::text AS rol, string_agg(m.etiqueta, ', ' ORDER BY m.orden) AS menus
  FROM sirve.rol_menu r JOIN sirve.menu m ON m.id = r.id_menu
 WHERE r.rol::text = 'REPRESENTANTE'
 GROUP BY r.rol;