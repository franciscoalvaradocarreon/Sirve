# Contrato de la API — SIRVE‑P (MVP 1)

> **Base:** `/api` · **Formato:** JSON · **Codificación:** UTF‑8
> **Persistencia:** PostgreSQL 17, esquema `sirve` (el que ya está cargado)
> **Autenticación:** ninguna en captura ni consulta (D‑11 / D‑13). El panel queda fuera de este contrato.

---

## 1. Convenciones

| Tema | Decisión |
|---|---|
| Nombres de campo | `snake_case`, iguales a las columnas. Evita una capa de mapeo y un lugar más donde equivocarse |
| Fechas | ISO‑8601 con zona: `2026-11-04T18:47:03-06:00` |
| Enteros | JSON number, nunca string |
| Nulos | `null` explícito, no cadena vacía |
| Identificadores | `id_*` numéricos; `id_cliente` es UUID del dispositivo |
| Paginación | ninguna: los volúmenes por pantalla son ≤ 3 000 filas |
| Errores | objeto `error` con `codigo`, `mensaje`, `detalle` |

### Formato de error

```json
{
  "error": {
    "codigo": "CASILLA_NO_APLICA",
    "mensaje": "La casilla 4512 no está declarada para la elección 5",
    "detalle": "fk_captura_casilla_eleccion"
  }
}
```

| HTTP | `codigo` | Cuándo |
|---|---|---|
| 400 | `VALIDACION` | falta un campo, un voto es negativo, la suma de votos no coincide con el detalle enviado |
| 400 | `OPCION_FUERA_DE_ELECCION` | llega un `id_opcion` que no pertenece a esa elección |
| 404 | `NO_ENCONTRADO` | casilla, elección o proceso inexistente |
| 409 | `CASILLA_NO_APLICA` | la casilla no está declarada para esa elección (la rechaza la clave foránea) |
| 500 | `ERROR_INTERNO` | fallo no previsto; se registra con el identificador de la petición |

---

## 2. Rutas

| Método | Ruta | Para qué |
|---|---|---|
| GET | `/procesos` | procesos de la entidad, el activo primero |
| GET | `/procesos/{id}/elecciones` | elecciones del proceso |
| GET | `/municipios?id_proceso=` | municipios con secciones en ese proceso |
| GET | `/secciones?id_municipio=&id_proceso=` | secciones y cuántas casillas tiene cada una |
| GET | `/casillas?id_seccion=&id_eleccion=` | casillas capturables y si ya tienen captura |
| GET | `/elecciones/{id}/opciones` | boleta en orden |
| GET | `/capturas/{id_casilla}/{id_eleccion}` | captura vigente con su desglose |
| POST | `/capturas` | guardar o reemplazar una captura |
| GET | `/avance?id_proceso=` | casillas esperadas, capturadas y faltantes |
| GET | `/resultados?id_eleccion=&id_municipio=` | votos por opción |

---

## 3. Detalle

### 3.1 `GET /procesos`

Devuelve los procesos de la entidad, el vigente primero.

```sql
SELECT p.id, p.anio, p.nombre, p.estado, p.activo, p.fecha_jornada,
       e.clave AS entidad
  FROM sirve.proceso_electoral p
  JOIN sirve.entidad e ON e.id = p.id_entidad
 WHERE e.clave = $1                 -- parámetro de configuración: '19'
 ORDER BY p.activo DESC, p.anio DESC;
```

```json
[
  {"id": 3, "anio": 2027, "nombre": "Proceso Electoral 2027", "estado": "PLANEACION",
   "activo": true,  "fecha_jornada": null,         "entidad": "19"},
  {"id": 2, "anio": 2024, "nombre": "Proceso Electoral 2024", "estado": "CERRADO",
   "activo": false, "fecha_jornada": "2024-06-02", "entidad": "19"}
]
```

> El 2027 aparece sin fecha. La app debe mostrarlo como «por definir», no como error.

### 3.2 `GET /procesos/{id}/elecciones`

```sql
SELECT id, clave, nombre, tipo, orden, activa
  FROM sirve.eleccion
 WHERE id_proceso = $1
 ORDER BY orden;
```

```json
[
  {"id": 4, "clave": "AYUNT", "nombre": "Ayuntamientos 2024", "tipo": "PRESIDENCIA_MUNICIPAL", "orden": 2, "activa": true},
  {"id": 5, "clave": "DIP",   "nombre": "Diputaciones locales 2024", "tipo": "DIPUTACION_LOCAL", "orden": 1, "activa": true}
]
```

### 3.3 `GET /municipios?id_proceso=2`

Solo los municipios que tienen secciones en ese proceso. En 2027 devolverá vacío: todavía no hay catálogo.

```sql
SELECT m.id, m.clave, m.nombre, count(s.id) AS secciones
  FROM sirve.municipio m
  JOIN sirve.seccion s ON s.id_municipio = m.id AND s.id_proceso = $1
 GROUP BY m.id, m.clave, m.nombre
 ORDER BY m.nombre;
```

### 3.4 `GET /secciones?id_municipio=39&id_proceso=2`

```sql
SELECT s.id, s.clave, count(k.id) AS casillas
  FROM sirve.seccion s
  LEFT JOIN sirve.casilla k ON k.id_seccion = s.id
 WHERE s.id_municipio = $1 AND s.id_proceso = $2
 GROUP BY s.id, s.clave
 ORDER BY length(s.clave), s.clave;   -- robusto: no falla si alguna clave no es numérica
```

> `clave` es texto porque hay secciones con ceros y alguna no numérica. Se ordena por su valor numérico.

### 3.5 `GET /casillas?id_seccion=123&id_eleccion=5`

Lo que pinta la pantalla de selección. Devuelve solo las casillas declaradas para esa elección y marca las ya capturadas.

```sql
SELECT k.id, k.clave, k.tipo,
       (c.id IS NOT NULL)      AS capturada,
       c.total_acta,
       c.aritmetica_ok
  FROM sirve.casilla k
  JOIN sirve.casilla_eleccion ce
    ON ce.id_casilla = k.id AND ce.id_eleccion = $2
  LEFT JOIN sirve.captura c
    ON c.id_casilla = k.id AND c.id_eleccion = $2
 WHERE k.id_seccion = $1
   AND k.activa
 ORDER BY CASE k.tipo
            WHEN 'B' THEN 1
            WHEN 'C1' THEN 2 WHEN 'C2' THEN 3 WHEN 'C3' THEN 4 WHEN 'C4' THEN 5
            WHEN 'C5' THEN 6 WHEN 'C6' THEN 7 WHEN 'C7' THEN 8 WHEN 'C8' THEN 9
            ELSE 10 END, k.tipo;
```

```json
[
  {"id": 4512, "clave": "2024-NL-039-1432-B",  "tipo": "B",  "capturada": true,  "total_acta": 350, "aritmetica_ok": true},
  {"id": 4513, "clave": "2024-NL-039-1432-C1", "tipo": "C1", "capturada": false, "total_acta": null, "aritmetica_ok": null}
]
```

### 3.6 `GET /elecciones/{id}/opciones`

El orden de esta respuesta **es** el orden de la boleta.

```sql
SELECT id, etiqueta, tipo, orden
  FROM sirve.opcion_boleta
 WHERE id_eleccion = $1 AND activo
 ORDER BY orden;
```

### 3.7 `GET /capturas/{id_casilla}/{id_eleccion}`

```sql
SELECT c.id, c.id_casilla, c.id_eleccion, c.total_acta, c.no_registrados,
       c.nulos, c.suma_opciones, c.diferencia, c.aritmetica_ok,
       c.motivo_inconsistencia, c.recibida_en
  FROM sirve.captura c
 WHERE c.id_casilla = $1 AND c.id_eleccion = $2;

SELECT v.id_opcion, o.etiqueta, v.votos
  FROM sirve.captura_voto v
  JOIN sirve.opcion_boleta o ON o.id = v.id_opcion
 WHERE v.id_captura = $1
 ORDER BY o.orden;
```

`404` si no hay captura.

### 3.8 `POST /capturas`

Crea o reemplaza. **Nunca falla por «ya existe»**: la misma casilla se puede recapturar.

```json
{
  "id_cliente": "185e55d1-9805-4b91-bced-acf72318805b",
  "id_casilla": 4512,
  "id_eleccion": 5,
  "total_acta": 350,
  "no_registrados": 10,
  "nulos": 10,
  "votos": [
    {"id_opcion": 148, "votos": 120},
    {"id_opcion": 149, "votos": 90},
    {"id_opcion": 151, "votos": 120}
  ],
  "autor_texto": null
}
```

**Validaciones, en este orden:**

1. `votos` no vacío y sin `id_opcion` repetidos.
2. Todos los `id_opcion` pertenecen a `id_eleccion`:
   ```sql
   SELECT count(*) FROM sirve.opcion_boleta
    WHERE id_eleccion = $1 AND id = ANY($2::int[]);
   ```
   Si no coinciden con el número enviado → `OPCION_FUERA_DE_ELECCION`.
3. `total_acta`, `no_registrados`, `nulos` ≥ 0 y `nulos ≤ total_acta`.
4. `suma_opciones` **la calcula el servidor** sumando `votos`; no se acepta del cliente.

**Transacción:**

```sql
BEGIN;

INSERT INTO sirve.captura (id_cliente, id_casilla, id_eleccion, total_acta,
                           no_registrados, nulos, suma_opciones, autor_texto)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (id_casilla, id_eleccion) DO UPDATE
   SET total_acta     = EXCLUDED.total_acta,
       no_registrados = EXCLUDED.no_registrados,
       nulos          = EXCLUDED.nulos,
       suma_opciones  = EXCLUDED.suma_opciones,
       autor_texto    = EXCLUDED.autor_texto,
       recibida_en    = now()
RETURNING id;

DELETE FROM sirve.captura_voto WHERE id_captura = $9;

INSERT INTO sirve.captura_voto (id_captura, id_opcion, votos)
SELECT $9, x.id_opcion, x.votos
  FROM unnest($10::int[], $11::int[]) AS x(id_opcion, votos);

COMMIT;
```

**Respuesta `201`:**

```json
{
  "id": 9001,
  "id_casilla": 4512,
  "id_eleccion": 5,
  "total_acta": 350,
  "no_registrados": 10,
  "nulos": 10,
  "suma_opciones": 330,
  "diferencia": 0,
  "aritmetica_ok": true,
  "recibida_en": "2026-11-04T18:47:03-06:00"
}
```

**Idempotencia.** Si la app reintenta tras un corte de red, manda el **mismo `id_cliente`**. El servidor busca primero:

```sql
SELECT id FROM sirve.captura WHERE id_cliente = $1;
```

Si existe, responde `200` con esa captura en lugar de crear otra. El `UNIQUE (id_cliente)` de la tabla lo garantiza incluso con dos peticiones simultáneas.

**Aritmética.** Si `total_acta ≠ suma + no_registrados + nulos`, la captura **se guarda igual**, con `aritmetica_ok = false` y su `diferencia`. La app debe mostrar la advertencia, no bloquear: el acta manda.

Si la aritmética no cierra, el servidor exige `motivo_inconsistencia` y lo guarda. Sin motivo → `400 VALIDACION`.

### 3.9 `GET /avance?id_proceso=2`

```sql
SELECT e.id, e.clave, e.nombre,
       count(ce.id_casilla)                        AS casillas,
       count(c.id)                                 AS capturadas,
       count(ce.id_casilla) - count(c.id)          AS faltantes,
       round(100.0 * count(c.id) / NULLIF(count(ce.id_casilla), 0), 1) AS avance_pct
  FROM sirve.eleccion e
  JOIN sirve.casilla_eleccion ce ON ce.id_eleccion = e.id
  LEFT JOIN sirve.captura c
         ON c.id_casilla = ce.id_casilla AND c.id_eleccion = e.id
 WHERE e.id_proceso = $1
 GROUP BY e.id, e.clave, e.nombre, e.orden
 ORDER BY e.orden;
```

```json
[
  {"id": 4, "clave": "AYUNT", "nombre": "Ayuntamientos 2021", "casillas": 7003,
   "capturadas": 6885, "faltantes": 118, "avance_pct": 98.3}
]
```

> El denominador incluye las casillas anuladas, que no tienen captura. Por eso el avance no llega a 100 %: es correcto, no un pendiente.

### 3.10 `GET /resultados?id_eleccion=4&id_municipio=39`

`id_municipio` es opcional; sin él, el resultado es estatal.

```sql
SELECT o.id, o.etiqueta, o.tipo,
       sum(v.votos)                                  AS votos,
       round(100.0 * sum(v.votos)
             / NULLIF(sum(sum(v.votos)) OVER (), 0), 2) AS porcentaje
  FROM sirve.captura_voto v
  JOIN sirve.captura c        ON c.id = v.id_captura
  JOIN sirve.casilla k        ON k.id = c.id_casilla
  JOIN sirve.seccion s        ON s.id = k.id_seccion
  JOIN sirve.opcion_boleta o  ON o.id = v.id_opcion
 WHERE c.id_eleccion = $1
   AND ($2::int IS NULL OR s.id_municipio = $2)
 GROUP BY o.id, o.etiqueta, o.tipo, o.orden
 ORDER BY o.orden;
```

> Las opciones con cero votos no aparecen: `captura_voto` no guarda filas en cero. Si la pantalla las necesita, se parte de `opcion_boleta` con `LEFT JOIN`.

### 3.11 Sobre los identificadores

Los id de elección **no son estables entre procesos** y no deben escribirse a mano en el código. En la base actual:

| Proceso | Elección | id |
|---|---|---|
| 2021 | Ayuntamientos | 1 |
| 2021 | Diputaciones locales | 2 |
| 2021 | Gobernatura | 3 |
| 2024 | Ayuntamientos | 4 |
| 2024 | Diputaciones locales | 5 |

La app siempre resuelve la elección desde GET /procesos/{id}/elecciones, por su clave (AYUNT, DIP, GOB, DIPFED). Escribir id_eleccion = 4 a mano en el código es la forma más rápida de capturar en la elección equivocada.

---

## 4. Flujo de la pantalla de captura

```
1. Elegir proceso        GET /procesos                 (normalmente el activo)
2. Elegir elección       GET /procesos/{id}/elecciones
3. Elegir municipio      GET /municipios?id_proceso
4. Elegir sección        GET /secciones?id_municipio&id_proceso
5. Elegir casilla        GET /casillas?id_seccion&id_eleccion   ← marca capturadas
6. Cargar boleta         GET /elecciones/{id}/opciones
7. Capturar votos        (pantalla con teclado numérico y suma en vivo)
8. Guardar               POST /capturas
```

Dos atajos que el contrato permite:

- **Por clave de casilla.** Si el representante conoce la clave, se puede resolver con una búsqueda directa y saltar los pasos 3 a 5.
- **Recaptura.** Al entrar a una casilla ya capturada, `GET /capturas/...` trae lo anterior; la app muestra «ya tiene captura» y ofrece reemplazarla.

---

## 5. Lo que la API hace cumplir, y lo que no

| Regla | Quién la impone |
|---|---|
| Una captura por casilla y elección | `UNIQUE (id_casilla, id_eleccion)` |
| Solo capturar donde la casilla aplica | clave foránea a `casilla_eleccion` |
| No duplicar por reintento | `UNIQUE (id_cliente)` + consulta previa |
| Suma de votos = detalle enviado | el servidor la calcula |
| Nada negativo, nulos ≤ total | `CHECK` en la tabla |
| Aritmética del acta | se guarda y se marca; no se corrige |

Fuera de este contrato, para más adelante:

- **Panel de administración** (usuarios, roles, módulos, embargo): requiere sesión y permisos.
- **Carga de cómputos oficiales** y contraste.
- **Exportaciones.**
- **Autenticación de la captura**: por decisión D‑11 no existe. El control real es la revisión del acta contra lo capturado.

---

## 6. Notas de implementación

- **Java 21 + Spring Boot 3.x**, `spring-jdbc` o `JdbcTemplate`. No se necesita JPA: son diez consultas.
- **Transacciones**: solo `POST /capturas` las requiere; el resto son lecturas.
- **Decimales**: los porcentajes se calculan en SQL con `round`. No se envían como texto.
- **Zona horaria**: el servidor guarda `timestamptz`; la API devuelve ISO con desfase y la app lo muestra en hora local.
- **Un solo parámetro de configuración**: la clave de entidad (`'19'`), que hoy identifica a Nuevo León. Cuando el partido cubra más estados, deja de ser constante y pasa a ser un filtro.
