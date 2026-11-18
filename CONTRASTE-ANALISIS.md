# Contraste entre el análisis inicial y lo construido

El análisis inicial (`D:\WorkspaceSIRVE\01_analisis`, ocho documentos, v3.0 de la
Fase 1) describe un sistema más grande que el que existe hoy. Este documento
compara, módulo por módulo, qué de aquel alcance está construido, qué está a
medias y qué no existe.

Léase junto con `REQUERIMIENTOS.md`, que describe **lo que el sistema hace**.
Aquí se describe **cuánto de la especificación cubre**.

Estado al 18 de noviembre de 2026 · versión en producción **v1.0.5**.

Cifras de la especificación: **63 requerimientos funcionales** (51 Must),
**51 no funcionales** y unas **60 reglas de negocio**, sobre 1 500 casillas,
1 500 representantes, hasta 6 elecciones y ≈ 9 000 capturas por jornada.

---

## Resumen

| Módulo | Requerimientos | Estado | Comentario |
|---|---|---|---|
| `CAT` catálogo electoral | 6 | **casi completo** | falta importación de casillas y lista nominal |
| `CAP` captura | 12 | **parcial** | funciona, pero sin historial de versiones |
| `PREP` agregación | 7 | **parcial** | avance sí; falta la marca de no oficial |
| `COM` cómputos oficiales | 3 | **no existe** | |
| `CTR` contraste | 4 | **no existe** | |
| `PRT` portal | 11 | **parcial** | sala sí; faltan embargo, exportación y leyenda |
| `ADM` administración | 12 | **parcial** | usuarios y roles sí; faltan interruptores y bitácora |
| `AUD` auditoría | 4 | **no existe** | |
| `ACC` acceso y abuso | 4 | **parcial** | se resolvió al revés: con credencial |

En una frase: **existe el primer tercio del sistema** —capturar, guardar y
mirar— y falta el resto: la segunda fuente (cómputos), el contraste entre ambas
y toda la capa de evidencia y auditoría que le da valor probatorio.

---

## Las cinco diferencias que hay que decidir

No son omisiones por descuido: son caminos distintos. Cada una necesita una
decisión explícita, porque cambian el alcance.

### 1. La captura exige credencial, y la especificación dice que no

```
especificación   RF-CAP-01, RF-ACC-01, RN-090, R-04
                 «la app abre y captura sin autenticación; no existe pantalla de acceso»

construido       cada teléfono se enrola con un código y recibe un pase de 256 bits
```

**Por qué se hizo así:** la propia especificación se contradice en el supuesto
S-04 —«el enlace de captura puede circular sin generar capturas masivas; si es
falso, se necesita algún control de acceso»—. Un enlace abierto que cualquiera
puede usar para escribir actas en el sistema del partido no es defendible.

**Lo que cuesta:** 299 teléfonos por enrolar, códigos con vigencia de 3 horas y
una persona coordinando el operativo.

**Decisión pendiente:** mantener el enrolamiento (recomendado) o abrir la
captura y apoyarse solo en límites por dispositivo.

### 2. La recaptura sobrescribe, y la especificación exige versiones

```
especificación   RN-002, RN-003, RN-004, RN-104, RNF-DAT-01
                 «una casilla puede tener varias capturas; solo una vigente;
                  la anterior pasa a REEMPLAZADA y permanece consultable»

construido       ON CONFLICT (id_casilla, id_eleccion) DO UPDATE
                 el valor anterior se pierde
```

**Por qué importa:** el objetivo del sistema es tener evidencia. Si un
representante captura mal y alguien corrige, hoy no queda rastro de lo que se
capturó primero ni de cuándo cambió. La especificación lo dice sin ambigüedad:
«ninguna corrección borra el valor anterior».

**Esta es, en mi opinión, la diferencia más importante de la lista.** No es una
pantalla que falta: es la propiedad que hace que el dato sirva para impugnar o
negociar.

**Lo que implica arreglarlo:** tabla de versiones, estado por versión, vista
vigente y una consulta de historial. Del orden de un día.

### 3. No existe la segunda fuente: los cómputos oficiales

```
especificación   módulos COM (3) y CTR (4), reglas RN-030 a RN-045
                 capturar el cómputo del consejo y contrastarlo contra el PREP propio

construido       no existe
```

Es el corazón de la propuesta de valor según el documento: «se impugna sin
evidencia y se negocia sin datos». Hoy el sistema solo guarda la mitad de la
comparación.

### 4. No existe la capa de auditoría

```
especificación   módulo AUD (4), reglas RN-100 a RN-106, RNF-SEG-09
                 bitácora append-only encadenada por hash, expediente por casilla,
                 hash SHA-256 de cada imagen, registro de cada consulta

construido       nada: no hay bitácora, ni hash de imágenes, ni registro de consultas
```

**Comprobado:** la tabla `acta_foto` no guarda ningún hash; no hay tabla de
bitácora.

### 5. No hay leyenda de «no oficial» ni control de embargo

```
especificación   RF-PRT-08, RF-PRT-09, RN-054, RN-060, RNF-CUM-03
                 «conteo propio del partido, no oficial», leyenda no desactivable;
                 embargo hasta la hora autorizada

construido       la sala no muestra ninguna leyenda, y publica 24 horas al día
```

**Comprobado:** cero menciones de «no oficial» en la pantalla de la sala.

Es barato de arreglar y de las cosas que más se notan: hoy cualquiera que abra
`/sala` ve cifras sin saber que son un conteo propio y sin saber de qué hora.

---

## Detalle por módulo

### `CAT` — catálogo electoral

| Requerimiento | Estado | Dónde / qué falta |
|---|---|---|
| RF-CAT-01 proceso con año, fecha y estado | **cumple** | `proceso_electoral`, con estados |
| RF-CAT-02 elecciones y cuáles se capturan | **cumple** | `eleccion.activa`; la app filtra |
| RF-CAT-03 partidos, coaliciones, candidaturas y orden | **parcial** | hay partidos, coaliciones y boletas; no hay tabla de candidaturas |
| RF-CAT-04 entidades, municipios, secciones, casillas | **cumple** | 8 268 casillas cargadas por elección |
| RF-CAT-05 importar casillas desde CSV con reporte | **falta** | las casillas se cargaron con SQL; la importación que existe es de capturistas |
| RF-CAT-06 lista nominal para participación | **falta** | |

### `CAP` — captura

| Requerimiento | Estado | Dónde / qué falta |
|---|---|---|
| RF-CAP-01 capturar sin autenticación | **no** | decisión 1 |
| RF-CAP-02 localizar casilla por búsqueda o clave | **parcial** | el teléfono lista las casillas asignadas; no hay búsqueda por clave |
| RF-CAP-03 elegir elección habilitada | **cumple** | |
| RF-CAP-04 votos por opción, no registrados y nulos | **cumple** | |
| RF-CAP-05 validar aritmética y permitir continuar con motivo | **parcial** | se marca inconsistente, pero no se pide motivo |
| RF-CAP-06 foto del acta comprimida | **parcial** | se comprime en el teléfono; el servidor acepta hasta 8 MB y no valida el contenido |
| RF-CAP-07 captura sin conexión y sincronización | **cumple** | cola en el teléfono + IndexedDB |
| RF-CAP-08 identificación opcional del representante | **cumple** | campo `autor_texto` |
| RF-CAP-09 hora del servidor como autoritativa | **cumple** | |
| RF-CAP-10 mostrar estado de la captura | **parcial** | el estado existe (`VIGENTE`), no se muestra al reabrir |
| RF-CAP-11 la nueva captura reemplaza y la anterior queda histórica | **no** | decisión 2 |
| RF-CAP-12 advertir si ya hay captura de otro dispositivo | **falta** | |

### `PREP` — agregación

| Requerimiento | Estado | Dónde / qué falta |
|---|---|---|
| RF-PREP-01 avance | **cumple** | `/reportes/operacion` |
| RF-PREP-02 agregar por sección, municipio, entidad y nacional | **parcial** | por municipio y distrito; falta entidad y nacional |
| RF-PREP-03 publicar con marca de no oficial | **falta** | decisión 5 |
| RF-PREP-04 recalcular en cada refresco | **cumple** | |
| RF-PREP-05 casillas sin captura, exportable | **parcial** | hay listado de atrasadas; no hay exportación |
| RF-PREP-06 participación con lista nominal | **falta** | |
| RF-PREP-07 marcar capturas inconsistentes | **parcial** | aparecen en operación; no en la sala |

### `COM` y `CTR` — cómputos y contraste

**No existen.** Son siete requerimientos: registrar el cómputo oficial por
casilla o distrito, con hora y fuente; corregirlo conservando versión; comparar
contra el PREP propio; clasificar cada diferencia y alertar por umbral.

### `PRT` — portal de resultados

| Requerimiento | Estado | Dónde / qué falta |
|---|---|---|
| RF-PRT-01 tablero sin sesión | **cumple** | `/sala` |
| RF-PRT-02 filtros por entidad, municipio, distrito, casilla | **parcial** | un combo por alcance de la elección |
| RF-PRT-03 panel de avance | **cumple** | |
| RF-PRT-04 refresco automático cada 5 min | **cumple** | cada 30 s, mejor que lo pedido |
| RF-PRT-05 refresco manual | **falta** | |
| RF-PRT-06 detalle de casilla con su acta | **falta** | la galería existe, pero en el panel, no en la sala |
| RF-PRT-07 exportar a Excel o PDF | **falta** | |
| RF-PRT-08 leyenda de no oficial | **falta** | decisión 5 |
| RF-PRT-09 embargo por hora | **falta** | |
| RF-PRT-10 botón de acceso al panel | **falta** | |
| RF-PRT-11 corregir una cifra desde el portal | **falta** | |

### `ADM` — panel de administración

| Requerimiento | Estado | Dónde / qué falta |
|---|---|---|
| RF-ADM-01 a 03 habilitar PREP, cómputos y contraste | **falta** | solo existe `sala.habilitada`, que apaga la publicación |
| RF-ADM-04 elegir qué elecciones se capturan | **cumple** | `eleccion.activa` |
| RF-ADM-05 ventanas programadas | **falta** | |
| RF-ADM-06 hora de embargo | **falta** | |
| RF-ADM-07 límite de capturas por dispositivo configurable | **parcial** | límite global por credencial e IP, no por dispositivo |
| RF-ADM-08 usuarios y roles | **cumple** | seis roles, permisos por menú |
| RF-ADM-09 semáforo de seguimientos | **falta** | |
| RF-ADM-10 bitácora de cambios | **falta** | |
| RF-ADM-11 usuario y contraseña | **cumple** | |
| RF-ADM-12 anular captura con motivo | **falta** | |

### `AUD` — auditoría

**No existe.** Ni bitácora, ni reconstrucción de la historia de una casilla, ni
expediente de evidencia, ni alerta de accesos anómalos.

### `ACC` — acceso abierto y control de abuso

| Requerimiento | Estado | Dónde / qué falta |
|---|---|---|
| RF-ACC-01 sin pantalla de acceso | **no** | decisión 1 |
| RF-ACC-02 identificador anónimo del dispositivo | **cumple** | el `id_cliente` viaja en cada captura, y el dispositivo está identificado |
| RF-ACC-03 límite de capturas por dispositivo y minuto | **parcial** | hay límite por credencial (600/min), muy holgado para el caso |
| RF-ACC-04 bloqueo temporal de un dispositivo abusivo | **falta** | |

---

## Requerimientos no funcionales: lo más relevante

| Requerimiento | Estado | Comentario |
|---|---|---|
| HTTPS obligatorio (RNF-SEG-01) | **cumple** | TLS con certificado propio, 80 redirige |
| Base y rol separados del SIH (RNF-AIS-03) | **cumple** | esquema `sirve`, base propia |
| Contenedores con memoria acotada (RNF-AIS-02) | **falta** | no hay límites en el compose |
| Panel con usuario y contraseña (RNF-SEG-03b) | **cumple** | BCrypt coste 12 |
| Bloqueo tras 5 intentos por cuenta (RNF-SEG-07) | **parcial** | límite por IP (12/min), no por cuenta |
| Hash SHA-256 de cada imagen (RNF-SEG-05) | **falta** | no se guarda ningún hash |
| Cifrado de respaldos (RNF-SEG-04) | **falta** | volcados en claro; el bucket es privado, pero el objeto no está cifrado por la aplicación |
| Portal no indexable (RNF-SEG-06) | **falta** | no hay `robots.txt` ni `noindex` |
| Cobertura de pruebas ≥ 70 % (RNF-MAN-02) | **falta** | no hay pruebas automatizadas |
| RPO ≤ 5 min (RNF-DIS-06) | **no cumplido** | respaldo diario: el RPO real es de hasta 24 h |
| Verificación semanal de restauración (RNF-DAT-06) | **falta** | nunca se ha probado una restauración completa |
| Retención 3 y 5 años (RNF-DAT-05) | **falta** | sin política; el bucket crece sin ciclo de vida |
| Aviso de privacidad (RNF-CUM-01) | **falta** | |

Del resto (rendimiento, compatibilidad, usabilidad) no hay medición: se
construyó con margen de sobra para el volumen de hoy, pero **no se ha probado
bajo la carga de la especificación** (600 usuarios concurrentes).

---

## Dimensión distinta a la especificada

La especificación supone **1 500 casillas** del universo del partido. Lo
cargado es el universo completo de Nuevo León:

```
casillas por elección        8 268       (especificación: 1 500 del partido)
elecciones de 2027               4       (especificación: hasta 6)
actas si se capturan las 4  33 072       (especificación: ≈ 9 000)
espacio estimado          9.5 GB         (especificación: ≈ 11 GB)
```

Esto no es un error, pero cambia las cuentas: el volumen de imágenes es el
triple, y el espacio disponible hoy es de 9.2 GB. La decisión sobre ampliar el
volumen o comprimir las fotos está tomada para después, y este contraste es la
razón por la que conviene revisarla antes de la jornada.

---

## Qué haría, en orden

```
1. leyenda «no oficial» en la sala                        horas, y es lo más visible
2. historial de versiones de la captura                   un día, y es el valor probatorio
3. hash SHA-256 de cada imagen al recibirla               medio día
4. bitácora de cambios y de consultas                     uno o dos días
5. módulo de cómputos + contraste                         la pieza grande
6. embargo por hora y botón de administración en la sala  horas
7. aviso de privacidad y robots.txt                       horas
```

Los puntos 1, 3, 6 y 7 son de horas y cierran huecos que se notan. El 2 y el 5
son los que cambian el sistema de «captura de datos» a «evidencia».

---

## Lo que este documento no dice

No dice que lo construido esté mal. Dice qué parte de la especificación cubre.
La especificación se escribió para un sistema completo; lo que existe es el
primer tercio, y funciona: captura sin conexión, guarda, agrega y publica.

La pregunta que sigue no es técnica: **¿qué alcance se necesita para esta
jornada?** Si es capturar y mirar, lo que hay sirve. Si es impugnar, faltan la
segunda fuente, el contraste y la evidencia.
