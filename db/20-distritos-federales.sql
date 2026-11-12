-- =====================================================================
-- SIRVE-P · Distritos federales de Nuevo León (14)
-- ---------------------------------------------------------------------
-- Fuente: resultados de diputaciones federales 2024 (INE), solo NL.
-- Se cargan con tipo FEDERAL en la misma tabla distrito.
--
-- Reejecutable.
-- =====================================================================

SET client_min_messages = warning;

INSERT INTO sirve.distrito (id_entidad, tipo, clave, nombre)
SELECT e.id, 'FEDERAL', v.clave, v.nombre
  FROM (VALUES
        ('001', 'SANTA CATARINA'),
        ('002', 'APODACA'),
        ('003', 'GRAL. ESCOBEDO'),
        ('004', 'SAN NICOLÁS DE LOS GARZA'),
        ('005', 'MONTERREY'),
        ('006', 'MONTERREY'),
        ('007', 'FRACC. VALLE DE LINCÓLN'),
        ('008', 'GUADALUPE'),
        ('009', 'LINARES'),
        ('010', 'MONTERREY'),
        ('011', 'GUADALUPE'),
        ('012', 'BENITO JUÁREZ'),
        ('013', 'SALINAS VICTORIA'),
        ('014', 'PESQUERÍA')
       ) AS v(clave, nombre)
  JOIN sirve.entidad e ON e.clave = '19'
 WHERE NOT EXISTS (SELECT 1 FROM sirve.distrito d
                    WHERE d.id_entidad = e.id AND d.tipo = 'FEDERAL' AND d.clave = v.clave);

SELECT clave, nombre FROM sirve.distrito
 WHERE tipo = 'FEDERAL' ORDER BY clave;
