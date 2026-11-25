-- ============================================================================
-- 023 · Menú del historial de capturas
--
-- Agrega la pantalla bajo Reportes y la asigna a quienes auditan: ADMIN,
-- COORDINADOR, ANALISTA y AUDITOR. El capturista no la ve, y el representante
-- tampoco: consulta actas y avance, no quién reemplazó qué.
--
--     psql -U User_app -d SIRVE -f migraciones/023-menu-historial.sql
-- ============================================================================

BEGIN;

INSERT INTO sirve.menu (clave, etiqueta, ruta, icono, orden, id_padre)
SELECT 'historial-captura', 'Historial', '/reportes/historial', 'History', 54,
       (SELECT id FROM sirve.menu WHERE clave = 'reportes')
WHERE NOT EXISTS (SELECT 1 FROM sirve.menu WHERE clave = 'historial-captura');

-- Los cuatro roles que ya ven la operación y la asignación.
INSERT INTO sirve.rol_menu (rol, id_menu)
SELECT r.rol, m.id
  FROM (VALUES ('ADMIN'::sirve.rol_usuario),
               ('COORDINADOR'::sirve.rol_usuario),
               ('ANALISTA'::sirve.rol_usuario),
               ('AUDITOR'::sirve.rol_usuario)) AS r(rol)
  CROSS JOIN sirve.menu m
 WHERE m.clave = 'historial-captura'
   AND NOT EXISTS (SELECT 1 FROM sirve.rol_menu rm
                    WHERE rm.rol = r.rol AND rm.id_menu = m.id);

COMMIT;
