-- =====================================================================
-- SIRVE-P · Datos de ejemplo: capturistas con diez casillas cada uno
-- ---------------------------------------------------------------------
-- Tres capturistas de Monterrey, cada uno con diez casillas de la elección
-- de Gobernatura 2027, y un teléfono pendiente de enrolar por persona.
--
-- Los códigos de enrolamiento son de mentira y están escritos aquí a
-- propósito, para poder probar. En producción se generan desde la pantalla
-- de capturistas y no se vuelven a mostrar.
--
-- Los nombres llevan el prefijo «PRUEBA» para poder borrarlos de un golpe.
--
-- Ejecutar como postgres, en la base SIRVE. Es reejecutable: primero borra lo
-- que haya dejado la corrida anterior.
-- =====================================================================

BEGIN;

-- Limpieza: al borrar el capturista caen en cascada sus casillas y teléfonos.
DELETE FROM sirve.capturista WHERE nombre LIKE 'PRUEBA %';

INSERT INTO sirve.capturista (nombre, telefono) VALUES
    ('PRUEBA MARÍA ELENA GARZA',   '8112345678'),
    ('PRUEBA JOSÉ LUIS RAMÍREZ',   '8112345679'),
    ('PRUEBA ANA CECILIA TREVIÑO', '8112345680');

/*
 * Diez casillas para cada uno.
 *
 * Se toman de Monterrey, en orden de sección y casilla, y se reparten por
 * bloques de diez. Se usa la elección 9 (Gobernatura 2027) para que las
 * casillas estén declaradas en `casilla_eleccion`: si no lo estuvieran, la
 * captura se rechazaría por la llave de la tabla.
 */
WITH ordenadas AS (
    SELECT k.id,
           row_number() OVER (ORDER BY length(s.clave), s.clave, k.clave) AS n
      FROM sirve.casilla k
      JOIN sirve.seccion s ON s.id = k.id_seccion
      JOIN sirve.proceso_electoral p ON p.id = s.id_proceso AND p.anio = 2027
      JOIN sirve.casilla_eleccion ce ON ce.id_casilla = k.id AND ce.id_eleccion = 9
     WHERE s.id_municipio = (SELECT id FROM sirve.municipio WHERE nombre = 'MONTERREY')
),
personas AS (
    SELECT id, row_number() OVER (ORDER BY id) AS i
      FROM sirve.capturista
     WHERE nombre LIKE 'PRUEBA %'
)
INSERT INTO sirve.capturista_casilla (id_capturista, id_casilla)
SELECT p.id, o.id
  FROM personas p
  JOIN ordenadas o ON o.n > (p.i - 1) * 10 AND o.n <= p.i * 10;

/*
 * Un teléfono por capturista, con su código.
 *
 * En la base se guarda el SHA-256 del código, nunca el código. Por eso aquí
 * aparecen los hashes ya calculados.
 *
 *     MARÍA ELENA GARZA    →  K7M2QX9P
 *     JOSÉ LUIS RAMÍREZ    →  T4RW8YHN
 *     ANA CECILIA TREVIÑO  →  B3CD6FGP
 */
INSERT INTO sirve.dispositivo (id_capturista, nombre, codigo_hash)
SELECT c.id, 'Teléfono de ejemplo', h.hash
  FROM (VALUES
        ('PRUEBA MARÍA ELENA GARZA',   'aca467967182579cd17036951428176d16d1fe096aa8debf3524dee706b30830'),
        ('PRUEBA JOSÉ LUIS RAMÍREZ',   'acd52918f2eaa84b1cf1a07d5a4b3d0d6000e34cb31ef690c9fd6d97b06ed2de'),
        ('PRUEBA ANA CECILIA TREVIÑO', 'd65b34ee4f6f677d5ae4f4fb3d9e1685ec62b0ea97602920d75b0597a4b6d7d8')
       ) AS h(nombre, hash)
  JOIN sirve.capturista c ON c.nombre = h.nombre;

COMMIT;

-- ---------------------------------------------------------------------
-- Comprobación
-- ---------------------------------------------------------------------
SELECT c.id, c.nombre, count(cc.id_casilla) AS casillas,
       (SELECT count(*) FROM sirve.dispositivo d WHERE d.id_capturista = c.id) AS telefonos
  FROM sirve.capturista c
  LEFT JOIN sirve.capturista_casilla cc ON cc.id_capturista = c.id
 WHERE c.nombre LIKE 'PRUEBA %'
 GROUP BY c.id, c.nombre
 ORDER BY c.id;

-- Qué casillas le tocaron a cada quien
SELECT c.nombre, s.clave AS seccion, k.clave AS casilla
  FROM sirve.capturista c
  JOIN sirve.capturista_casilla cc ON cc.id_capturista = c.id
  JOIN sirve.casilla k ON k.id = cc.id_casilla
  JOIN sirve.seccion s ON s.id = k.id_seccion
 WHERE c.nombre LIKE 'PRUEBA %'
 ORDER BY c.nombre, length(s.clave), s.clave, k.clave;
