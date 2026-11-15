-- =====================================================================
-- SIRVE-P · Resultados de prueba para Gobernatura 2027
-- ---------------------------------------------------------------------
-- Inserta capturas con votos al azar en casillas que todavía no tienen
-- ninguna. Sirve para ver la sala y el tablero con datos, no para medir nada.
--
-- Cómo funciona:
--   · toma casillas al azar de la elección, de las que aún no tienen captura
--   · sortea el total del acta entre 100 y 400 votos
--   · reparte los votos válidos entre las opciones con pesos al azar, y cuadra
--     la suma para que la aritmética quede bien (diferencia = 0)
--   · reparte la hora de recepción en las últimas seis horas, para que la
--     gráfica de ritmo no salga en una sola barra
--
-- Es reejecutable: cada corrida agrega casillas nuevas, nunca toca las que ya
-- tienen captura.
--
-- Ejecutar como User_app (o el dueño de los datos) en la base SIRVE.
-- =====================================================================

DO $$
DECLARE
    -- Elección de Gobernatura 2027 en producción es la 9; en desarrollo, la 8.
    -- Cambia este número si tu base tiene otro.
    v_eleccion  int := 9;

    -- Cuántas casillas llenar. Baja este número para una prueba rápida.
    v_cuantas   int := 1000;

    v_casilla   int;
    v_captura   bigint;
    v_total     int;
    v_nulos     int;
    v_noreg     int;
    v_validos   int;
    v_suma      int;
    v_pesos     numeric[];
    v_votos     int[];
    v_peso      numeric;
    v_suma_peso numeric;
    v_sobra     int;
    v_i         int;
    v_hechas    int := 0;
    v_opciones  int[];
BEGIN
    -- Opciones de la boleta, en orden. Se guardan una vez.
    SELECT array_agg(id ORDER BY orden) INTO v_opciones
      FROM sirve.opcion_boleta
     WHERE id_eleccion = v_eleccion AND activo;

    IF v_opciones IS NULL THEN
        RAISE EXCEPTION 'La elección % no tiene opciones de boleta', v_eleccion;
    END IF;

    FOR v_casilla IN
        SELECT ce.id_casilla
          FROM sirve.casilla_eleccion ce
         WHERE ce.id_eleccion = v_eleccion
           AND NOT EXISTS (SELECT 1 FROM sirve.captura c
                            WHERE c.id_casilla = ce.id_casilla
                              AND c.id_eleccion = ce.id_eleccion)
         ORDER BY random()
         LIMIT v_cuantas
    LOOP
        v_total   := 100 + floor(random() * 300)::int;
        v_nulos   := floor(random() * 4)::int;
        v_noreg   := floor(random() * 3)::int;
        v_validos := v_total - v_nulos - v_noreg;

        -- Pesos al azar: el cuadrado hace que casi siempre gane alguien y que
        -- los partidos pequeños no queden todos empatados en cero.
        v_pesos := ARRAY[]::numeric[];
        v_suma_peso := 0;
        FOR v_i IN 1 .. array_length(v_opciones, 1) LOOP
            v_peso := power(random(), 2) + 0.02;
            v_pesos := v_pesos || v_peso;
            v_suma_peso := v_suma_peso + v_peso;
        END LOOP;

        -- Reparto proporcional, con el residuo a la primera opción.
        v_votos := ARRAY[]::int[];
        v_suma := 0;
        FOR v_i IN 1 .. array_length(v_opciones, 1) LOOP
            v_votos := v_votos || floor(v_validos * v_pesos[v_i] / v_suma_peso)::int;
            v_suma := v_suma + v_votos[v_i];
        END LOOP;

        v_sobra := v_validos - v_suma;
        IF v_sobra <> 0 THEN
            v_votos[1] := v_votos[1] + v_sobra;
        END IF;

        -- votos_validos, diferencia y aritmetica_ok son columnas generadas:
        -- la base las calcula sola a partir de estas cifras, así que no se
        -- insertan. Al cuadrar total = suma + no registrados + nulos, la
        -- aritmética queda bien y la diferencia en cero.
        INSERT INTO sirve.captura (
            id_cliente, id_casilla, id_eleccion, estado, origen,
            total_acta, no_registrados, nulos, suma_opciones, recibida_en
        ) VALUES (
            gen_random_uuid(), v_casilla, v_eleccion, 'VIGENTE', 'PORTAL',
            v_total, v_noreg, v_nulos, v_validos, now() - (random() * interval '6 hours')
        )
        RETURNING id INTO v_captura;

        FOR v_i IN 1 .. array_length(v_opciones, 1) LOOP
            IF v_votos[v_i] > 0 THEN
                INSERT INTO sirve.captura_voto (id_captura, id_opcion, votos)
                VALUES (v_captura, v_opciones[v_i], v_votos[v_i]);
            END IF;
        END LOOP;

        v_hechas := v_hechas + 1;
    END LOOP;

    RAISE NOTICE 'Capturas insertadas: % (elección %)', v_hechas, v_eleccion;
END $$;

-- ---------------------------------------------------------------------
-- Resumen
-- ---------------------------------------------------------------------
SELECT count(*) AS capturas,
       sum(total_acta) AS votos_totales,
       min(recibida_en) AS primera,
       max(recibida_en) AS ultima
  FROM sirve.captura
 WHERE id_eleccion = 9 AND estado = 'VIGENTE';

SELECT o.etiqueta, sum(cv.votos) AS votos
  FROM sirve.captura c
  JOIN sirve.captura_voto cv ON cv.id_captura = c.id
  JOIN sirve.opcion_boleta o ON o.id = cv.id_opcion
 WHERE c.id_eleccion = 9 AND c.estado = 'VIGENTE'
 GROUP BY o.etiqueta, o.orden
 ORDER BY votos DESC, o.orden;

-- ---------------------------------------------------------------------
-- Para borrar los datos de prueba después
-- ---------------------------------------------------------------------
-- Las capturas no borran sus votos en cascada, así que hay que quitarlos
-- primero. Ajusta los identificadores de elección si hace falta.
--
--   DELETE FROM sirve.captura_voto
--    WHERE id_captura IN (SELECT id FROM sirve.captura WHERE id_eleccion = 9);
--
--   DELETE FROM sirve.captura WHERE id_eleccion = 9;
--
-- Esto borra TODAS las capturas de esa elección, incluidas las reales. Si ya
-- hay captura de verdad en la base, acota por fecha:
--
--   DELETE FROM sirve.captura_voto WHERE id_captura IN (
--     SELECT id FROM sirve.captura
--      WHERE id_eleccion = 9 AND origen = 'PORTAL' AND capturada_por IS NULL);
--
--   DELETE FROM sirve.captura
--    WHERE id_eleccion = 9 AND origen = 'PORTAL' AND capturada_por IS NULL;