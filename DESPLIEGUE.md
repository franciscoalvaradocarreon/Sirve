# Despliegue

Cómo está montado SIRVE-P y cómo se reconstruye si el servidor se pierde.

Servidor: **159.54.142.97** · `sirve.159.54.142.97.sslip.io` (SIRVE) y
`159.54.142.97.sslip.io` (SIH) · mismo host para los dos.

> Este documento describe el servidor **actual**, que ya no es el Ampere de
> Oracle Linux. El anterior (140.84.191.170) se perdió al vencer la prueba de
> OCI y con él sus datos; de ahí que todo lo de abajo sea reconstruible.

---

## 1. Qué hay

```
Ubuntu 24.04.5 · kernel 7.0.0-1013-oracle · x86_64
2 vCPU AMD EPYC · 952 MB de RAM · 48 GB de disco (38 libres)
Docker 29.10.0, habilitado al arranque
```

### Los contenedores y sus límites

| contenedor | qué es | límite de memoria |
|---|---|---|
| `sirve-p-app-1` | SIRVE: Spring Boot :8080 | 420 MB |
| `sirve-p-db-1` | PostgreSQL 17 de SIRVE | 256 MB |
| `sih-ia-app-1` | el SIH | 512 MB |
| `sih-ia-db-1` | PostgreSQL del SIH | 320 MB |
| `sih-ia-caddy-1` | el proxy, 80 y 443 | 96 MB |

La imagen que corre hoy es `ghcr.io/franciscoalvaradocarreon/sirve:v2.0.1`;
lo que se despliegue después lo dice el `.env`.

Los cinco **sí caben a la vez**: en uso hay unos 450 MB de 952. `modo.sh`
existe para el caso contrario, poder apagar uno de los dos sistemas.

### Redes

```
proxy            compartida: el Caddy y la aplicación de SIRVE
sirve-p_interna  privada entre la aplicación y su base (internal: true)
sih-ia_default   la del SIH
```

El Caddy entra a `proxy` desde el override del SIH. **Nada de SIRVE publica
puertos**: el único que escucha es el proxy.

### Rutas

```
/opt/sirve-p/
├── docker-compose.yml        del repositorio, lo actualiza el despliegue
├── .env                      claves y configuración, permisos 600
├── planos/                   3 114 SVG · 355 MB · montado de solo lectura
├── respaldos/respaldo-bucket.sh
└── modo.sh                   turna los sistemas

/opt/sih/                     el SIH: compose, Caddyfile, override, .env

volúmenes
  sirve-p_datos_sirve         la base
  sirve-p_actas               las fotos · 8 268 archivos · 905 MB
```

La carpeta `/opt/sirve-p` **no lleva código**: el despliegue solo trae el
compose y la imagen. El código vive en GitHub.

---

## 2. Reconstruir desde cero

### 2.1 La instancia

En la consola de OCI: *Compute → Instances → Create*. Con Ubuntu 24.04 y la
llave SSH del proyecto. Al terminar, anotar la IP pública.

```
por qué Ubuntu y no Oracle Linux: la imagen que había disponible era Ubuntu.
Los guiones usan apt; si se elige Oracle Linux, cambian dnf y los nombres de
los paquetes.
```

### 2.2 Paquetes y Docker

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg unzip

# Docker desde su repositorio: el paquete de Ubuntu es viejo y no trae
# «docker compose» (plug-in), que es lo que usan todos los guiones.
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg |
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" |
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu
```

El filtrado de entrada lo hace la **lista de seguridad de OCI**; dentro del
servidor no hay cortafuegos propio. Solo hacen falta abiertos el 22, el 80 y
el 443.

### 2.3 La red compartida

```bash
docker network create proxy
```

El compose de SIRVE la declara como `external: true`: si no existe, no arranca.

### 2.4 El proxy

El Caddy **es el del SIH** y atiende los dos sitios. En `/opt/sih/Caddyfile`:

```caddyfile
(sih) {
	encode zstd gzip
	reverse_proxy sih-ia-app-1:8080
}

{$SITIO} { import sih }                    # 159.54.142.97.sslip.io

http://<IP>, http://127.0.0.1, http://localhost { import sih }

sirve.<IP>.sslip.io {
	encode zstd gzip
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "strict-origin-when-cross-origin"
		Content-Security-Policy "default-src 'self'; …"
	}
	@actuator path /actuator /actuator/*
	respond @actuator 404
	reverse_proxy sirve-p-app-1:8080
}
```

Dos detalles que cuestan una tarde si se olvidan:

- **El Caddy tiene que estar en la red `proxy`.** Si se levanta con
  `docker compose -f docker-compose.yml up -d`, el override **no se carga** y
  el Caddy se queda solo en su red: el sitio de SIRVE responde **502**. Hay que
  ejecutar `docker compose` **sin `-f`**, desde `/opt/sih`.
- `respond @actuator 404` no es adorno: el índice de actuator no se publica.
  La salud se consulta desde dentro del contenedor.

### 2.5 La configuración de SIRVE

```bash
sudo mkdir -p /opt/sirve-p/planos
sudo chown -R ubuntu:ubuntu /opt/sirve-p
```

`/opt/sirve-p/.env`, permisos 600:

```
DB_NAME=SIRVE
DB_ADMIN_USER=User_app
DB_PASSWORD=…                 clave del dueño de la base
DB_APP_USER=sirve_app
DB_PASSWORD_APP=…             clave del rol de la aplicación
JWT_CLAVE=…                   48 caracteres
JWT_HORAS=12
MAIL_HOST=… MAIL_PORT=… MAIL_USERNAME=… MAIL_PASSWORD=…
ALERTAS_NOMBRE=SIRVE-P
SALA_HABILITADA=false
TZ=America/Monterrey
RUTA_PLANOS=/opt/sirve-p/planos
IMAGEN_APP=ghcr.io/franciscoalvaradocarreon/sirve:vX.Y.Z
```

Las claves se generan con `openssl rand -base64 48 | tr -dc A-Za-z0-9 | head -c 32`.
La del correo es la misma cuenta que usa el SIH.

### 2.6 La base

La primera vez, el contenedor crea la base y el rol administrador con lo que
diga el `.env`. Después se restaura el último volcado del bucket:

```bash
# bajar el volcado (ver sección 3 para la identidad)
oci os object get --auth instance_principal --region mx-queretaro-1 \
  --bucket-name sirve-sih-respaldos \
  --name "sirve/base/sirve-2026-11-23_2119.dump" --file /tmp/restaurar.dump

cd /opt/sirve-p && sudo docker compose up -d db

sudo docker cp /tmp/restaurar.dump sirve-p-db-1:/tmp/v.dump
sudo docker exec -i sirve-p-db-1 pg_restore -U User_app -d SIRVE \
  --no-owner --clean --if-exists -j 2 /tmp/v.dump

# el rol de la aplicación y sus permisos
sudo docker exec -i sirve-p-db-1 psql -U User_app -d SIRVE <<'SQL'
CREATE ROLE sirve_app LOGIN PASSWORD '<DB_PASSWORD_APP>';
GRANT USAGE ON SCHEMA sirve TO sirve_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sirve TO sirve_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sirve TO sirve_app;
SQL

sudo rm -f /tmp/restaurar.dump
```

`pg_restore` avisa de decenas de errores «role sirve_app does not exist»: el
volcado trae los permisos de ese rol, que todavía no existe. Se ignora y se
concede después, como arriba.

Comprobar que quedó:

```sql
SELECT 'secciones', count(*) FROM sirve.seccion
UNION ALL SELECT 'casillas', count(*) FROM sirve.casilla
UNION ALL SELECT 'capturistas', count(*) FROM sirve.capturista
UNION ALL SELECT 'capturas', count(*) FROM sirve.captura
UNION ALL SELECT 'actas', count(*) FROM sirve.acta_foto;
```

Con los datos de la migración: `3 114 · 8 268 · 301 · 23 928 · 8 268`
(las secciones son 8 773 contando los tres procesos).

### 2.7 Las actas

Las fotos no vienen en el volcado: viven en el volumen y se respaldan aparte,
archivo por archivo. Para traerlas:

```bash
mkdir -p /tmp/actas
oci os object bulk-download --auth instance_principal --region mx-queretaro-1 \
  --bucket-name sirve-sih-respaldos --prefix "sirve/actas/" \
  --download-dir /tmp/actas --overwrite
```

Bajan como `sirve/actas/<año>/<archivo>.jpg`. Se colocan en el volumen según
la ruta que dice la base:

```bash
VOL=/var/lib/docker/volumes/sirve-p_actas/_data
sudo docker exec -i sirve-p-db-1 psql -U User_app -d SIRVE -t -A \
  -c "SELECT ruta FROM sirve.acta_foto ORDER BY ruta" > /tmp/rutas.txt

sudo mkdir -p "$VOL"
while read -r ruta; do
  sudo mkdir -p "$VOL/$(dirname "$ruta")"
  sudo cp "/tmp/actas/sirve/actas/$ruta" "$VOL/$ruta"
done < /tmp/rutas.txt

sudo chown -R 100:101 "$VOL"          # el usuario de la aplicación
sudo chmod -R u=rwX,g=rX,o= "$VOL"
```

`bulk-download` pide confirmación al pasar de mil objetos y **aborta** si no
se le da una opción: `--overwrite` o `--no-overwrite`.

### 2.8 Los planos

Son 3 114 archivos de 355 MB, generados con `cartografia/generar-planos.py` a
partir de la carta de INEGI. Se llevan al servidor comprimidos y se descomprimen
en su sitio:

```bash
sudo unzip -q planos.zip -d /opt/sirve-p      # crea /opt/sirve-p/planos
sudo chmod -R a+rX /opt/sirve-p/planos
```

**Al reemplazar la carpeta con `mv`, el montaje se rompe.** Docker apunta al
inodo del directorio: si se sustituye por otro, el contenedor sigue viendo el
viejo y todo da 404. Hay que vaciar y copiar **dentro** de la carpeta, o
reiniciar el contenedor después.

---

## 3. Desplegar una versión

La imagen **se construye en GitHub**, no en el servidor: el `docker build` de
SIRVE compila Maven y Vite y necesita ~1.5 GB; aquí hay 952 MB.

```
GitHub Actions ──push──▶ ghcr.io/franciscoalvaradocarreon/sirve:vX.Y.Z
                                          │
                                    (pull) ▼
                              servidor: docker compose up -d
```

### Secretos del repositorio

| secreto | valor |
|---|---|
| `SSH_HOST` | `159.54.142.97` |
| `SSH_USER` | `ubuntu` |
| `SSH_KEY` | llave privada del proyecto |
| `RUTA_DESPLIEGUE` | `/opt/sirve-p` |

### Lanzarlo

```bash
git tag -a v2.0.2 -m "…" && git push origin v2.0.2
gh workflow run cd.yml -f version=v2.0.2
```

El flujo hace, en orden: construye con buildx y publica en GHCR · entra al
registro desde el servidor con el token de la corrida (por la entrada
estándar, no en la línea de comandos) · copia `docker-compose.yml` · descarga
la imagen · `up -d --no-build` · escribe `IMAGEN_APP` en el `.env` · verifica
que `/api/version` responda dentro del contenedor.

Lo de escribir el `.env` no es cosmético: sin eso, un `docker compose up`
hecho a mano vuelve a la imagen anterior, y ya pasó una vez sin que nadie lo
notara.

### Volver atrás

```bash
sudo -n sed -i 's#^IMAGEN_APP=.*#IMAGEN_APP=ghcr.io/franciscoalvaradocarreon/sirve:v2.0.0#' /opt/sirve-p/.env
cd /opt/sirve-p && sudo docker compose up -d --no-build
```

---

## 4. Respaldos

Un temporizador del sistema, todas las noches.

```
sirve-respaldo.timer    09:00 UTC = 03:00 de Monterrey
                        Persistent: si estaba apagado, corre al encender
sirve-respaldo.service  /opt/sirve-p/respaldos/respaldo-bucket.sh
```

### Qué sube

```
sirve/base/sirve-2026-11-23_2119.dump    la base de SIRVE
sih/base/sih-2026-11-23_2119.dump        la base del SIH
sirve/actas/<año>/…                      solo las fotos que falten
sirve/estado/respaldo.json               cuándo corrió y si falló
```

**No deja nada en el servidor.** Los volcados se escriben en `/dev/shm`, que es
memoria: el archivo existe mientras dura la subida y se borra al terminar. El
disco se comparte con las actas y no tiene sentido guardar ahí lo que ya está
en el bucket.

Se conservan **30 días** de volcados; las actas no se borran nunca.

### La identidad con el bucket

El servidor no tiene llaves en disco: usa la identidad de la instancia
(`--auth instance_principal`). Quien autoriza es un **grupo dinámico** de OCI:

```
grupo    sirve-respaldos-dg
regla    instance.id = 'ocid1.instance.oc1.mx-queretaro-1.anyxeljr…'
política Allow dynamic-group Default/sirve-respaldos-dg to read|manage objects
         in compartment <el del bucket>
```

Si se crea una instancia nueva, **hay que agregar su OCID a esa regla**. Mientras
no se haga, `oci os object list` responde «no existe o no estás autorizado» —
que es distinto de un error de permisos explícito y despista.

El CLI no viene instalado; se puso en un *venv* para no chocar con los paquetes
de Ubuntu: `/home/ubuntu/oci-venv/bin/oci`.

### Probar una restauración

Un respaldo que nunca se ha restaurado es una suposición. Hay un guion que lo
comprueba sin tocar producción:

```bash
sudo bash /opt/sirve-p/mantenimiento/probar-restauracion.sh
echo $?        # 0 = restaura completo
```

Baja el último volcado del bucket, lo restaura en una base aparte y compara
contra producción **conteos y huellas del contenido** (md5 de las filas
ordenadas). Al terminar borra la base de prueba y el volcado. La primera
corrida, del 23 de noviembre: 18 comparaciones, todas iguales, 23 segundos.

---

## 5. Operación diaria

### Los dos sistemas en el mismo host

Caben juntos (~450 MB de 952), pero si hace falta apagar uno:

```bash
sudo /opt/sirve-p/modo.sh sirve     # detiene el SIH y levanta SIRVE
sudo /opt/sirve-p/modo.sh sih       # al revés
sudo /opt/sirve-p/modo.sh estado    # qué corre y cuánta memoria queda
```

El **proxy no se detiene nunca**: es quien tiene los certificados.

### Dónde mirar

```bash
cd /opt/sirve-p && sudo docker compose ps
sudo docker stats --no-stream
df -h /                # disco
free -m                # memoria y swap
sudo journalctl -u sirve-respaldo -n 30      # respaldos
sudo docker logs --tail 50 sirve-p-app-1     # aplicación
```

### Los límites y por qué

```
app    420 MB de tope, heap de 192 MB, recolector serial
       MaxRAMPercentage reservaría 75 % del límite y no dejaría aire
       para metadatos ni pilas de hilo
db     256 MB, shared_buffers 48 MB, 30 conexiones
       el trabajo es lectura corta y escritura de una fila
proxy  96 MB
```

---

## 6. Cuando algo falla

### El sitio entero no responde

```
1. ping 159.54.142.97           (OCI no responde ICMP: normal que falle)
2. puertos 22, 80 y 443         si los tres están cerrados, no es la aplicación
3. tracert                      si la ruta llega a la red de Oracle y muere,
                                es la instancia, no la red
4. consola de OCI → instancia   ¿RUNNING o STOPPED?
```

Así se diagnosticó la caída de noviembre: la prueba gratuita venció, la
instancia se detuvo y después OCI la reclamó. **Los contenedores vuelven solos**
al arrancar la máquina (todos con `unless-stopped`), pero los datos que no
estén en el bucket no vuelven.

### 502 en SIRVE y el SIH responde

Casi siempre lo mismo: el Caddy no está en la red `proxy`.

```bash
sudo docker inspect sih-ia-caddy-1 \
  --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
```

Si no aparece `proxy`, se levantó con `-f` y el override no se cargó:

```bash
cd /opt/sih && sudo docker compose up -d caddy
```

### 502 en los dos sitios

El Caddy está arriba pero no alcanza a la aplicación. Mirar los registros del
contenedor y, sobre todo, si consumió su límite de memoria.

### La aplicación arranca y muere

```bash
sudo docker logs --tail 40 sirve-p-app-1
```

`OutOfMemoryError` con `ExitOnOutOfMemoryError` → reinicio en bucle. Subir
`HEAP_APP` un poco, o apagar el otro sistema.

### Los planos dan 404

El montaje se rompió al reemplazar la carpeta:

```bash
sudo docker compose restart app
```

### El respaldo dice que corrió pero el estado no cambia

`oci os object put` **no sobrescribe sin `--force`**. Ya está en el guion; si
se reescribe el guion, no quitarlo.

### SSH no conecta y el sitio sí

Las conexiones de administración se cortan cuando se abren muchas seguidas.
Reintentar; no es una caída.

---

## 7. El APK

La aplicación de captura es una WebView que apunta al sitio. **La dirección va
dentro del paquete**: si cambia el dominio o la IP, hay que recompilarlo.

```
paquete      mx.sirve.captura
versión      1.1.0 (código 3)
dirección    https://sirve.159.54.142.97.sslip.io/movil
manifiesto   minSdk 21 · targetSdk 33
```

Se compila sin Gradle (`apk/compilar-apk.ps1`: aapt + javac + d8 + zipalign) y
se firma con el keystore del proyecto (`apk/firmar-apk.ps1`).

```
keystore     apk/sirve/sirve-release-2026.keystore
contraseña   apk/sirve/sirve-release-2026.clave.txt
```

**Los dos se guardan juntos y fuera del repositorio.** Perderlos obliga a firmar
con otra llave, y un APK firmado con otra llave no se instala encima: hay que
desinstalar en cada teléfono y volver a enreolar.

El manifiesto necesita `<uses-sdk>`. Sin él Android asume `targetSdkVersion 1`,
agrega permisos que la app no pidió (incluido `READ_PHONE_STATE`) y desde
Android 14 rechaza la instalación.

---

## 8. Lo que falta

```
dominio propio          con uno, mover el servidor no obliga a recompilar el APK
aviso de caída          hoy nadie se entera hasta que alguien busca
aviso si falla el respaldo   queda en el estado y en el journal, sin avisar
```
