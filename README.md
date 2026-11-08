# SIRVE-P

Sistema de captura de resultados electorales por casilla, para uso interno de partido.

Captura los votos del acta en la casilla, los guarda en PostgreSQL y los consulta desde
un panel. Sin funciones ni disparadores en la base: la integridad se sostiene con llaves,
restricciones y el orden de las operaciones.

---

## Estructura

```
SIRVE/
├── BackendJava/        API REST · Spring Boot 4 · Java 21 · Maven
├── FrontendReact/      Interfaz · React 19 · Vite · TypeScript · Tailwind 4
├── db/                 Scripts de instalación de la base, en orden
├── docs/               Contrato de API y documentación
├── Dockerfile          Imagen única: el jar lleva el front dentro
├── docker-compose.yml  Proyecto sirve-p: base propia + aplicación
└── Caddyfile.sitio     Bloque para el proxy del servidor
```

El front se compila dentro del jar y se sirve del mismo origen que la API. Un solo
contenedor, un solo puerto, sin CORS que coordinar en producción.

---

## Cómo levantarlo

### Requisitos

- Java 21
- Node 22 o superior
- PostgreSQL 17

### Base de datos

Los scripts de `db/` se ejecutan **en orden alfabético**. El `00` crea el esquema
completo; los demás cargan catálogos.

```bash
psql -U postgres -d SIRVE -f db/00-esquema.sql
psql -U postgres -d SIRVE -f db/01-entidades.sql
# … y así hasta el 32
```

Con Docker no hay que hacerlo a mano: el `docker-compose.yml` monta `db/` como
directorio de inicialización y Postgres los corre solo la primera vez.

Después hace falta el rol de la aplicación (ver `db/99-rol-aplicacion.sh`):

```sql
ALTER ROLE sirve_app WITH LOGIN PASSWORD 'tu-clave';
GRANT USAGE ON SCHEMA sirve TO sirve_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sirve TO sirve_app;
```

### Backend

```bash
cd BackendJava
mvn spring-boot:run
```

Arranca en `http://127.0.0.1:8081`. La clave de la base se lee de
`src/main/resources/application-local.yml`, que no se versiona:

```yaml
spring:
  datasource:
    username: sirve_app
    password: "la-clave"
```

### Frontend

```bash
cd FrontendReact
npm install
npm run dev
```

En `http://localhost:5173`. Vite reenvía `/api` al 8081, así que las rutas son las
mismas que en producción.

### Todo junto con Docker

```bash
docker network create proxy     # una sola vez en el servidor
docker compose up -d --build
```

---

## Modelo de datos

Nueve tablas de catálogo y dos de captura:

```
entidad → municipio → seccion → casilla
proceso_electoral → eleccion → opcion_boleta
distrito (local y federal)
casilla_eleccion        qué casillas participan en qué elección
captura                 cabecera del acta: total, no registrados, nulos
captura_voto            desglose por opción de la boleta
```

Decisiones que conviene conocer:

- **Una captura por casilla y elección.** Recapturar reemplaza; no hay historial.
- **La suma de opciones la calcula el servidor**, nunca el cliente.
- **La aritmética no bloquea.** Si el total no cuadra, la captura se guarda con
  `aritmetica_ok = false` y su diferencia. El acta manda.
- **Los distritos son de la sección**, no de la casilla: una sección pertenece a un
  distrito local y a uno federal.
- **Una casilla puede participar en unas elecciones y en otras no.** En 2024,
  diputaciones tiene 7 485 casillas y ayuntamientos 7 440: las especiales no son iguales.

### Catálogos cargados

| Proceso | Secciones | Casillas |
|---|---|---|
| 2021 | 2 782 | 7 051 |
| 2024 | 2 877 | 7 485 |
| 2027 | 3 114 | 6 228 |

---

## API

El contrato completo está en [`docs/API-CONTRATO.md`](docs/API-CONTRATO.md).

```
GET  /api/procesos
GET  /api/procesos/{id}/elecciones
GET  /api/municipios?id_proceso=
GET  /api/distritos?tipo=LOCAL|FEDERAL&id_proceso=
GET  /api/secciones?id_proceso=[&id_municipio=]
GET  /api/casillas?id_eleccion=[&id_municipio=&seccion=&distrito_local=&distrito_federal=]
GET  /api/elecciones/{id}/opciones
GET  /api/capturas/{id_casilla}/{id_eleccion}
POST /api/capturas
```

---

## Pantallas

```
Catálogos
├── Procesos
├── Elecciones      con casillas, boleta y avance
├── Municipios
├── Distritos       locales y federales en una sola tabla
├── Secciones       filtros por distrito federal, local y municipio
└── Casillas        filtros más número de sección

Captura
└── Capturar casilla   boleta en dos columnas, Enter avanza, suma en vivo
```

Interfaz minimalista, con un color primario definido en un solo lugar
(`FrontendReact/src/utils/tema.ts`) y modo claro u oscuro.

---

## Estado

Funcionando: catálogos, captura y consulta.

Pendiente:

- Reporte de avance por elección
- Autenticación (hoy la captura no tiene control de acceso, por decisión de diseño)
- Aplicación móvil

---

## Lo que no está en el repositorio

- **Credenciales**: `.env.local` y `application-local.yml` están ignorados.
- **Datos**: la carpeta `2021/` con respaldos y la lista nominal queda fuera.
  Contiene datos personales de millones de personas.
- **Cartografía**: los shapefiles del INE (`docs/19 NUEVO LEON/`, 88 MB) se descargan
  aparte. El generador `generar-2027-oficial.py` los espera en esa ruta.
