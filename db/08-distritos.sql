-- =====================================================================
-- SIRVE-P · Distritos locales de Nuevo León (26)
-- ---------------------------------------------------------------------
-- Requiere: 01-entidades.sql
-- Reejecutable.
-- =====================================================================

SET client_min_messages = warning;

INSERT INTO sirve.distrito (id_entidad, tipo, clave, nombre)
SELECT e.id, 'LOCAL', v.clave, v.nombre
  FROM (VALUES
        ('01', 'Distrito local 1'),
        ('02', 'Distrito local 2'),
        ('03', 'Distrito local 3'),
        ('04', 'Distrito local 4'),
        ('05', 'Distrito local 5'),
        ('06', 'Distrito local 6'),
        ('07', 'Distrito local 7'),
        ('08', 'Distrito local 8'),
        ('09', 'Distrito local 9'),
        ('10', 'Distrito local 10'),
        ('11', 'Distrito local 11'),
        ('12', 'Distrito local 12'),
        ('13', 'Distrito local 13'),
        ('14', 'Distrito local 14'),
        ('15', 'Distrito local 15'),
        ('16', 'Distrito local 16'),
        ('17', 'Distrito local 17'),
        ('18', 'Distrito local 18'),
        ('19', 'Distrito local 19'),
        ('20', 'Distrito local 20'),
        ('21', 'Distrito local 21'),
        ('22', 'Distrito local 22'),
        ('23', 'Distrito local 23'),
        ('24', 'Distrito local 24'),
        ('25', 'Distrito local 25'),
        ('26', 'Distrito local 26')
       ) AS v(clave, nombre)
  JOIN sirve.entidad e ON e.clave = '19'
 WHERE NOT EXISTS (SELECT 1 FROM sirve.distrito d
                    WHERE d.id_entidad = e.id AND d.tipo = 'LOCAL' AND d.clave = v.clave);

SELECT count(*) AS distritos FROM sirve.distrito WHERE tipo = 'LOCAL';
