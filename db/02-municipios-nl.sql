-- =====================================================================
-- SIRVE-P · Catálogo de municipios de Nuevo León (51)
-- ---------------------------------------------------------------------
-- Se aplica sobre la tabla que ya existe: sirve.municipio
--     id, id_entidad, clave, nombre
--
-- La clave es el número municipal que usa el estado en sus actas
-- (001 = ABASOLO). El id_entidad se resuelve por la clave INEGI '19'.
--
-- Requiere haber ejecutado 01-entidades.sql.
-- Es reejecutable: no duplica filas.
-- =====================================================================

SET client_min_messages = warning;

INSERT INTO sirve.municipio (id_entidad, clave, nombre)
SELECT e.id, v.clave, v.nombre
  FROM (VALUES
        (  1, '001', 'ABASOLO'),
        (  2, '002', 'AGUALEGUAS'),
        (  3, '003', 'LOS ALDAMAS'),
        (  4, '004', 'ALLENDE'),
        (  5, '005', 'ANAHUAC'),
        (  6, '006', 'APODACA'),
        (  7, '007', 'ARAMBERRI'),
        (  8, '008', 'BUSTAMANTE'),
        (  9, '009', 'CADEREYTA JIMENEZ'),
        ( 10, '010', 'CARMEN'),
        ( 11, '011', 'CERRALVO'),
        ( 12, '012', 'CIENEGA DE FLORES'),
        ( 13, '013', 'CHINA'),
        ( 14, '014', 'DR. ARROYO'),
        ( 15, '015', 'DR. COSS'),
        ( 16, '016', 'DR. GONZALEZ'),
        ( 17, '017', 'GALEANA'),
        ( 18, '018', 'GARCIA'),
        ( 19, '019', 'SAN PEDRO GARZA GARCIA'),
        ( 20, '020', 'GRAL. BRAVO'),
        ( 21, '021', 'GRAL. ESCOBEDO'),
        ( 22, '022', 'GRAL. TERAN'),
        ( 23, '023', 'GRAL. TREVIÃ‘O'),
        ( 24, '024', 'GRAL. ZARAGOZA'),
        ( 25, '025', 'GRAL. ZUAZUA'),
        ( 26, '026', 'GUADALUPE'),
        ( 27, '027', 'LOS HERRERAS'),
        ( 28, '028', 'HIDALGO'),
        ( 29, '029', 'HIGUERAS'),
        ( 30, '030', 'HUALAHUISES'),
        ( 31, '031', 'ITURBIDE'),
        ( 32, '032', 'JUAREZ'),
        ( 33, '033', 'LAMPAZOS DE NARANJO'),
        ( 34, '034', 'LINARES'),
        ( 35, '035', 'MARIN'),
        ( 36, '036', 'MELCHOR OCAMPO'),
        ( 37, '037', 'MIER Y NORIEGA'),
        ( 38, '038', 'MINA'),
        ( 39, '039', 'MONTEMORELOS'),
        ( 40, '040', 'MONTERREY'),
        ( 41, '041', 'PARAS'),
        ( 42, '042', 'PESQUERIA'),
        ( 43, '043', 'LOS RAMONES'),
        ( 44, '044', 'RAYONES'),
        ( 45, '045', 'SABINAS HIDALGO'),
        ( 46, '046', 'SALINAS VICTORIA'),
        ( 47, '047', 'SAN NICOLAS DE LOS GARZA'),
        ( 48, '048', 'SANTA CATARINA'),
        ( 49, '049', 'SANTIAGO'),
        ( 50, '050', 'VALLECILLO'),
        ( 51, '051', 'VILLALDAMA')
       ) AS v(numero, clave, nombre)
  JOIN sirve.entidad e ON e.clave = '19'
 WHERE NOT EXISTS (SELECT 1 FROM sirve.municipio m
                    WHERE m.id_entidad = e.id AND m.clave = v.clave);

-- Comprobación
SELECT count(*) AS municipios
  FROM sirve.municipio m
  JOIN sirve.entidad e ON e.id = m.id_entidad
 WHERE e.clave = '19';

SELECT m.clave, m.nombre
  FROM sirve.municipio m
  JOIN sirve.entidad e ON e.id = m.id_entidad
 WHERE e.clave = '19'
 ORDER BY m.clave
 LIMIT 5;
