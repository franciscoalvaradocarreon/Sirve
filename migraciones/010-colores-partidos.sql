-- =====================================================================
-- SIRVE-P · Colores de partidos y coaliciones
-- ---------------------------------------------------------------------
-- La tabla de partidos ya existía con una columna «color», pero vacía, y las
-- coaliciones no tenían dónde guardarlo.
--
-- El color se guarda en la opción de boleta, que es lo que se dibuja: una
-- coalición no es un partido y no hereda un color de forma natural, así que
-- cada opción lleva el suyo. Los partidos lo toman de su catálogo, para que
-- cambiar el color de un partido se refleje en todas sus elecciones.
--
-- Ejecutar como User_app (dueño de los datos) en la base SIRVE.
-- =====================================================================

BEGIN;

-- 1) Colores de los partidos, según sus colores oficiales.
UPDATE sirve.partido SET color = v.color
  FROM (VALUES
    ('PAN',          '#0D47A1'),
    ('PRI',          '#C62828'),
    ('PRD',          '#E6B800'),
    ('PVEM',         '#2E7D32'),
    ('PT',           '#8E0000'),
    ('MC',           '#FF6F00'),
    ('MORENA',       '#9B1B30'),
    ('VIDA_NL',      '#00897B'),
    ('ESO',          '#5E35B1'),
    ('LIBERAL',      '#FFB300'),
    ('PESNL',        '#795548'),
    ('JUSTICIALISTA','#37474F'),
    ('NANL',         '#78909C'),
    ('FXM',          '#EC407A'),
    ('RSP',          '#AD1457'),
    ('PES',          '#7B1FA2')
  ) AS v(clave, color)
 WHERE sirve.partido.clave = v.clave
   AND sirve.partido.color IS DISTINCT FROM v.color;

-- 2) La opción de boleta lleva el color que se dibuja.
ALTER TABLE sirve.opcion_boleta
    ADD COLUMN IF NOT EXISTS color text;

ALTER TABLE sirve.opcion_boleta
    DROP CONSTRAINT IF EXISTS opcion_boleta_color_check;

ALTER TABLE sirve.opcion_boleta
    ADD CONSTRAINT opcion_boleta_color_check
    CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$');

-- 3) Los partidos toman el color de su catálogo.
UPDATE sirve.opcion_boleta o
   SET color = p.color
  FROM sirve.partido p
 WHERE o.id_partido = p.id
   AND p.color IS NOT NULL
   AND o.color IS DISTINCT FROM p.color;

-- 4) Las coaliciones, color propio: el de la alianza, más oscuro que el de
--    cualquiera de sus integrantes para que se distinga en la gráfica.
UPDATE sirve.opcion_boleta o SET color = v.color
  FROM (VALUES
    ('C_PAN_PRI_PRD', '#1A237E'),
    ('C_PAN_PRI',     '#283593'),
    ('C_PAN_PRD',     '#3949AB'),
    ('C_PRI_PRD',     '#8E1B1B'),
    ('C_PVEM_MORENA', '#1B5E20'),
    ('C_PVEM_PT',     '#33691E'),
    ('C_PT_MORENA',   '#4E342E'),
    ('C_PVEM_PT_MORENA', '#33691E'),
    ('CI',            '#455A64'),
    ('CI_1',          '#455A64')
  ) AS v(etiqueta, color)
 WHERE o.etiqueta = v.etiqueta
   AND o.tipo = 'COALICION'
   AND o.color IS DISTINCT FROM v.color;

-- 5) Lo que quede sin color —partidos nuevos o etiquetas raras— toma un gris
--    neutro, para que la gráfica nunca salga con huecos.
UPDATE sirve.opcion_boleta SET color = '#546E7A' WHERE color IS NULL;

COMMIT;

-- ---------------------------------------------------------------------
-- Comprobación
-- ---------------------------------------------------------------------
SELECT p.clave AS partido, p.color
  FROM sirve.partido p ORDER BY p.id;

SELECT o.tipo::text, o.etiqueta, o.color
  FROM sirve.opcion_boleta o
 WHERE o.id_eleccion = 9
 ORDER BY o.orden;
