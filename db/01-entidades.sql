-- =====================================================================
-- SIRVE-P · Catálogo de entidades (32 estados)
-- ---------------------------------------------------------------------
-- Se aplica sobre la tabla que ya existe: sirve.entidad
--     id, clave character(2), nombre_corto, nombre
--
-- 1. Agrega la columna activo, que habilita o corta la captura del estado.
-- 2. Carga las 32 entidades con la clave de dos dígitos del INEGI.
--
-- Es reejecutable: no duplica filas ni falla si ya está aplicado.
-- Ejecutar conectado a SIRVE como postgres.
-- =====================================================================

SET client_min_messages = warning;

-- 1. Columna activo (idempotente)
ALTER TABLE sirve.entidad ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN sirve.entidad.activo IS
    'Apaga la captura de todo el estado sin borrar su catálogo.';

-- 2. Las 32 entidades
INSERT INTO sirve.entidad (clave, nombre_corto, nombre)
SELECT v.clave, v.corto, v.nombre
  FROM (VALUES
        ('01', 'AGS',   'Aguascalientes'),
        ('02', 'BC',    'Baja California'),
        ('03', 'BCS',   'Baja California Sur'),
        ('04', 'CAMP',  'Campeche'),
        ('05', 'COAH',  'Coahuila de Zaragoza'),
        ('06', 'COL',   'Colima'),
        ('07', 'CHIS',  'Chiapas'),
        ('08', 'CHIH',  'Chihuahua'),
        ('09', 'CDMX',  'Ciudad de México'),
        ('10', 'DGO',   'Durango'),
        ('11', 'GTO',   'Guanajuato'),
        ('12', 'GRO',   'Guerrero'),
        ('13', 'HGO',   'Hidalgo'),
        ('14', 'JAL',   'Jalisco'),
        ('15', 'MEX',   'México'),
        ('16', 'MICH',  'Michoacán de Ocampo'),
        ('17', 'MOR',   'Morelos'),
        ('18', 'NAY',   'Nayarit'),
        ('19', 'NL',    'Nuevo León'),
        ('20', 'OAX',   'Oaxaca'),
        ('21', 'PUE',   'Puebla'),
        ('22', 'QRO',   'Querétaro'),
        ('23', 'QROO',  'Quintana Roo'),
        ('24', 'SLP',   'San Luis Potosí'),
        ('25', 'SIN',   'Sinaloa'),
        ('26', 'SON',   'Sonora'),
        ('27', 'TAB',   'Tabasco'),
        ('28', 'TAMPS', 'Tamaulipas'),
        ('29', 'TLAX',  'Tlaxcala'),
        ('30', 'VER',   'Veracruz de Ignacio de la Llave'),
        ('31', 'YUC',   'Yucatán'),
        ('32', 'ZAC',   'Zacatecas')
       ) AS v(clave, corto, nombre)
 WHERE NOT EXISTS (SELECT 1 FROM sirve.entidad e WHERE e.clave = v.clave);

-- 3. Comprobación
SELECT count(*) AS entidades,
       count(*) FILTER (WHERE activo) AS activas
  FROM sirve.entidad;

SELECT clave, nombre_corto, nombre, activo
  FROM sirve.entidad
 ORDER BY clave
 LIMIT 5;
