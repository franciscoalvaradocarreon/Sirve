-- =====================================================================
-- SIRVE-P · Cargar 2027 con los resultados de DF 2024
-- ---------------------------------------------------------------------
-- Para cada casilla de 2027 que todavía no tiene captura, busca su
-- equivalente en la elección de Diputaciones federales 2024 —misma sección y
-- mismo tipo de casilla— y copia sus cifras, repartiendo los votos entre las
-- opciones de 2027.
--
-- Las opciones no son las mismas: 2024 tiene 16 y 2027 tiene 17. Se cruzan por
-- etiqueta, y los votos de las que ya no existen se reparten proporcionalmente
-- entre las que sí. Así el total del acta se respeta y la estructura de
-- partidos se parece a la real de 2024.
--
-- Los totales son reales; el reparto por partido es una aproximación. Sirve
-- para probar la sala y el tablero, no para leer resultados.
--
-- El reparto se calcula con arreglos en memoria, no con tablas temporales:
-- crear y destruir una tabla por casilla —dieciocho mil veces— agota la
-- memoria del catálogo y la carga se detiene con «out of shared memory».
--
-- Ejecutar como User_app (dueño de los datos) en la base SIRVE.
-- =====================================================================

DO $$
DECLARE
    -- Elección de origen: Diputaciones federales 2024.
    v_origen   int := 6;
    -- Elecciones a llenar. NULL = todas las del proceso activo, salvo el
    -- origen. Así el mismo script sirve para una elección concreta o para
    -- todas, sin editarlo.
    v_destinos int[] := NULL;
    -- Si es cierto, borra las capturas que ya existen en cada destino antes de
    -- llenarlo. Sin esto, las elecciones que ya tienen datos se dejan intactas.
    v_reemplazar boolean := false;
    -- Cuántas casillas por elección. NULL = todas las que falten.
    v_limite   int := NULL;

    v_eleccion int;
    v_casilla  int;
    v_origen_casilla int;
    v_total    int;
    v_nulos    int;
    v_noreg    int;
    v_validos  int;
    v_captura  bigint;

    v_ids      int[];
    v_pesos    bigint[];
    v_votos    bigint[];
    v_suma_peso bigint;
    v_suma     bigint;
    v_residuo  bigint;
    v_max      bigint;
    v_max_i    int;
    v_i        int;

    v_hechas   int;
    v_sin_origen int;
BEGIN
    -- Si no se indicaron destinos, se toman TODAS las elecciones menos la de
    -- origen, sin importar de qué proceso sean: las de 2021 y 2024 también
    -- necesitan datos para que la pantalla no muestre ceros.
    IF v_destinos IS NULL THEN
        SELECT array_agg(e.id ORDER BY e.id) INTO v_destinos
          FROM sirve.eleccion e
         WHERE e.id <> v_origen;
    END IF;

    FOREACH v_eleccion IN ARRAY v_destinos LOOP
        IF v_reemplazar THEN
            DELETE FROM sirve.captura_voto
             WHERE id_captura IN (SELECT id FROM sirve.captura WHERE id_eleccion = v_eleccion);
            DELETE FROM sirve.captura WHERE id_eleccion = v_eleccion;
            RAISE NOTICE 'Elección %: capturas anteriores borradas', v_eleccion;
        END IF;
        v_hechas := 0;
        v_sin_origen := 0;

        /*
         * Mapa de origen por casilla destino.
         *
         * Primero se busca la misma sección y el mismo tipo de casilla; si no
         * existe —2027 tiene casillas que 2024 no tenía—, se toma otra casilla
         * de la misma sección. Se construye una vez por elección, no por
         * casilla: hacerlo dentro del bucle multiplicaría el trabajo por seis
         * mil.
         */
        DROP TABLE IF EXISTS mapa_origen;
        CREATE TEMP TABLE mapa_origen AS
        SELECT d.id_casilla,
               o.id_casilla AS origen,
               o.total_acta,
               o.nulos,
               o.no_registrados,
               (o.tipo = d.tipo) AS exacto
          FROM (SELECT k.id AS id_casilla, s.clave AS seccion, k.tipo, s.id_municipio
                  FROM sirve.casilla_eleccion ce
                  JOIN sirve.casilla k ON k.id = ce.id_casilla
                  JOIN sirve.seccion s ON s.id = k.id_seccion
                 WHERE ce.id_eleccion = v_eleccion
                   AND NOT EXISTS (SELECT 1 FROM sirve.captura c
                                    WHERE c.id_casilla = ce.id_casilla
                                      AND c.id_eleccion = ce.id_eleccion)) d
          CROSS JOIN LATERAL (
                /*
                 * Orden de preferencia:
                 *   1. misma sección y mismo tipo de casilla
                 *   2. misma sección, otro tipo
                 *   3. otra sección del mismo municipio
                 *
                 * El tercer caso cubre secciones que en 2024 no existían: sin
                 * él, medio millar de casillas por elección quedarían vacías y
                 * el avance nunca llegaría al 100 %.
                 */
                SELECT k2.id AS id_casilla, k2.tipo,
                       c.total_acta, c.nulos, c.no_registrados
                  FROM sirve.casilla_eleccion ce2
                  JOIN sirve.casilla k2 ON k2.id = ce2.id_casilla
                  JOIN sirve.seccion s2 ON s2.id = k2.id_seccion
                  JOIN sirve.captura c ON c.id_casilla = k2.id AND c.id_eleccion = v_origen
                 WHERE ce2.id_eleccion = v_origen
                   AND s2.id_municipio = d.id_municipio
                   -- Sin votos válidos no hay qué repartir: esas actas de
                   -- 2024 no sirven como origen y se busca otra.
                   AND (c.total_acta - c.nulos - c.no_registrados) > 0
                 ORDER BY (s2.clave = d.seccion) DESC, (k2.tipo = d.tipo) DESC, k2.id
                 LIMIT 1
          ) o;

        RAISE NOTICE 'Elección %: % casillas por llenar, % con equivalente exacto',
            v_eleccion,
            (SELECT count(*) FROM mapa_origen),
            (SELECT count(*) FROM mapa_origen WHERE exacto);

        FOR v_casilla, v_origen_casilla, v_total, v_nulos, v_noreg IN
            SELECT id_casilla, origen, total_acta, nulos, no_registrados
              FROM mapa_origen
             ORDER BY id_casilla
             LIMIT coalesce(v_limite, 1000000)
        LOOP
            v_validos := v_total - v_nulos - v_noreg;
            CONTINUE WHEN v_validos <= 0;

            -- Opciones de la elección destino, en orden, con los votos que les
            -- corresponden en el origen (cero si la etiqueta no existía).
            SELECT array_agg(o2.id ORDER BY o2.orden),
                   array_agg(coalesce(cv.votos, 0)::bigint ORDER BY o2.orden)
              INTO v_ids, v_pesos
              FROM sirve.opcion_boleta o2
              LEFT JOIN sirve.opcion_boleta o1
                     ON o1.id_eleccion = v_origen
                    AND o1.etiqueta = o2.etiqueta
                    AND o1.activo
              LEFT JOIN sirve.captura_voto cv
                     ON cv.id_opcion = o1.id
                    AND cv.id_captura = (SELECT c.id FROM sirve.captura c
                                          WHERE c.id_casilla = v_origen_casilla
                                            AND c.id_eleccion = v_origen)
             WHERE o2.id_eleccion = v_eleccion AND o2.activo;

            SELECT coalesce(sum(x), 0) INTO v_suma_peso FROM unnest(v_pesos) AS x;
            IF v_suma_peso = 0 THEN
                v_sin_origen := v_sin_origen + 1;
                CONTINUE;
            END IF;

            -- Reparto proporcional y residuo al que más recibe.
            v_suma := 0;
            v_max := -1;
            v_max_i := 1;
            FOR v_i IN 1 .. array_length(v_ids, 1) LOOP
                v_votos[v_i] := floor(v_validos * v_pesos[v_i] / v_suma_peso)::bigint;
                v_suma := v_suma + v_votos[v_i];
                IF v_votos[v_i] > v_max THEN
                    v_max := v_votos[v_i];
                    v_max_i := v_i;
                END IF;
            END LOOP;

            v_residuo := v_validos - v_suma;
            v_votos[v_max_i] := v_votos[v_max_i] + v_residuo;

            INSERT INTO sirve.captura (
                id_cliente, id_casilla, id_eleccion, estado, origen,
                total_acta, no_registrados, nulos, suma_opciones, recibida_en
            ) VALUES (
                gen_random_uuid(), v_casilla, v_eleccion, 'VIGENTE', 'PORTAL',
                v_total, v_noreg, v_nulos, v_validos,
                now() - (random() * interval '8 hours')
            ) RETURNING id INTO v_captura;

            INSERT INTO sirve.captura_voto (id_captura, id_opcion, votos)
            SELECT v_captura, x.id, x.v
              FROM unnest(v_ids, v_votos) AS x(id, v)
             WHERE x.v > 0;

            v_hechas := v_hechas + 1;
        END LOOP;

        RAISE NOTICE 'Elección %: % capturas creadas, % sin origen', v_eleccion, v_hechas, v_sin_origen;
    END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- Resumen
-- ---------------------------------------------------------------------
SELECT e.id, e.nombre,
       count(c.id) AS capturas,
       sum(c.total_acta) AS votos
  FROM sirve.eleccion e
  LEFT JOIN sirve.captura c ON c.id_eleccion = e.id AND c.estado = 'VIGENTE'
 WHERE e.id IN (6,7,8,9,10)
 GROUP BY e.id, e.nombre
 ORDER BY e.id;
