# Despliegue

Servidor: **140.84.191.170** · mismo host del SIH.

```
http://140.84.191.170:8088
```

Sin dominio todavía, así que se publica por IP y puerto, sin TLS.

---

## Cómo está montado

```
                    ┌──────────────────────────────────────┐
   Internet ──8088──▶  sirve-p-app-1  (Spring Boot :8080)  │
                    │        │                             │
                    │        ▼                             │
                    │  sirve-p-db-1   (PostgreSQL 17)      │
                    │      volumen sirve-p_datos_sirve     │
                    └──────────────────────────────────────┘
```

Sin Caddy de por medio. El SIH tiene el suyo en 80 y 443 y no se toca: SIRVE
publica su puerto directamente mediante `docker-compose.override.yml`, un
archivo que vive **solo en el servidor** y no está en el repositorio.

Cuando exista dominio, ese archivo se elimina y el sitio se declara en el
Caddyfile del SIH, como en el SIH mismo.

### Archivos en el servidor

```
/opt/sirve-p/
├── docker-compose.yml             del repositorio
├── docker-compose.override.yml    propio del servidor (publica el 8088)
├── .env                           claves, permisos 600
├── db/                            31 scripts, fuera del repositorio
├── Dockerfile                     del repositorio
├── BackendJava/                   del repositorio
└── FrontendReact/                 del repositorio
```

`db/` no está en Git: si se reinstala desde cero, hay que copiarlo aparte.

---

## Por qué la imagen se construye en el servidor

El servidor es un **Ampere de Oracle (aarch64)** y los ejecutores de GitHub son
amd64. Se intentó construir para las dos arquitecturas con QEMU y el paso
emulado llevaba más de dos horas sin terminar.

En el servidor, la misma construcción tarda **dos minutos**, porque es ARM
nativo. Por eso el despliegue copia el código y construye allí, en lugar de
descargar una imagen de un registro.

La imagen queda etiquetada con la versión (`sirve-p:v1.0.2`), así que se puede
volver a una anterior.

---

## Primera instalación (ya hecha)

Queda como referencia para reconstruir el servidor:

```bash
sudo mkdir -p /opt/sirve-p && sudo chown opc:opc /opt/sirve-p
docker network create proxy          # el compose la declara como externa

# desde tu máquina
scp docker-compose.yml sih:/opt/sirve-p/
scp -r db sih:/opt/sirve-p/
scp docker-compose.override.yml sih:/opt/sirve-p/

# en el servidor
cd /opt/sirve-p
sudo docker compose build app
sudo docker compose up -d --no-build
```

El `.env` del servidor:

```ini
DB_NAME=SIRVE
DB_ADMIN_USER=User_app
DB_PASSWORD=<clave de administración>
DB_APP_USER=sirve_app
DB_PASSWORD_APP=<clave de la aplicación>
IMAGEN_APP=sirve-p:local
```

`DB_PASSWORD_APP` **también** se pasa al contenedor de la base: el script
`99-rol-aplicacion.sh` la usa para crear el rol `sirve_app`. Sin ella el script
aborta y la aplicación no puede conectar.

---

## Actualizar

### Desde GitHub Actions

*Actions → Desplegar → Run workflow* con la etiqueta o rama.

Hace lo mismo que a mano: empaqueta el código con `git archive`, lo copia, y
construye en el servidor. Necesita cuatro secretos:

```
SSH_HOST         140.84.191.170
SSH_USER         opc
SSH_KEY          la clave privada completa
RUTA_DESPLIEGUE  /opt/sirve-p
```

### A mano

```powershell
# desde tu máquina
git archive --format=tar -o $env:TEMP\sirve-src.tar HEAD
scp $env:TEMP\sirve-src.tar sih:/tmp/
ssh sih "cd /opt/sirve-p && tar -x -f /tmp/sirve-src.tar && rm /tmp/sirve-src.tar && \
         IMAGEN_APP=sirve-p:v1.0.3 sudo -n docker compose build app && \
         IMAGEN_APP=sirve-p:v1.0.3 sudo -n docker compose up -d --no-build app"
```

### Volver a una versión anterior

Las imágenes quedan en el servidor:

```bash
sudo docker images sirve-p
IMAGEN_APP=sirve-p:v1.0.1 sudo -n docker compose up -d --no-build app
```

---

## El puerto 8088

Está abierto en la lista de seguridad de Oracle. Si hace falta reabrirlo en el
cortafuegos del sistema:

```bash
sudo firewall-cmd --permanent --add-port=8088/tcp && sudo firewall-cmd --reload
# o, sin firewalld
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8088 -j ACCEPT
sudo service iptables save
```

---

## Comprobar

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8088/actuator/health/liveness
curl -s http://127.0.0.1:8088/api/procesos
```

Y desde fuera, en el navegador: `http://140.84.191.170:8088`

Si el puerto responde pero la API devuelve `ERROR_INTERNO`, casi siempre es la
base: `sudo docker compose logs db | tail -30`.

---

## Cuando llegue el dominio

1. Registro DNS: tipo `A`, nombre `sirve`, valor `140.84.191.170`.
2. Borrar `/opt/sirve-p/docker-compose.override.yml` (deja de publicar el 8088).
3. Conectar el contenedor de la aplicación a la red del Caddy del SIH.
4. Agregar el bloque al Caddyfile del SIH —el de [`Caddyfile.sitio`](Caddyfile.sitio)—
   y recargar.
5. Cerrar el 8088 en la lista de seguridad.

**Validar antes de recargar**, porque un error de sintaxis deja sin servicio
también al SIH:

```bash
docker exec sih-ia-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec sih-ia-caddy-1 caddy reload   --config /etc/caddy/Caddyfile
```

---

## Respaldos

```bash
docker exec sirve-p-db-1 pg_dump -U User_app -Fc SIRVE > sirve-$(date +%F).dump
```

Restaurar:

```bash
cat sirve-2026-11-08.dump | docker exec -i sirve-p-db-1 pg_restore -U User_app -d SIRVE --clean
```
