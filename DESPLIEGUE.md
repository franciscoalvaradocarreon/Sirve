# Despliegue en el servidor

Servidor: **140.84.191.170** · mismo host del SIH.

Mientras no haya dominio, SIRVE se publica por IP y puerto:

```
http://140.84.191.170:8088
```

Sin certificado. El tráfico viaja sin cifrar; alcanza para pruebas, pero antes
de cargar datos reales conviene el dominio.

---

## Lo que hay que tener antes

| Cosa | Quién |
|---|---|
| Imagen publicada en GHCR | el pipeline, al empujar una etiqueta `v*` |
| Puerto **8088** abierto | tú: lista de seguridad de Oracle **y** firewall del sistema |
| Credencial para descargar la imagen | tú: un token de GitHub con `read:packages` |
| Acceso SSH al servidor | tú |

### El puerto 8088, en dos lugares

Oracle tiene dos cortafuegos y hay que abrir el puerto en los dos. Abrir solo
uno es el error más común del primer despliegue: el contenedor arriba, Caddy
bien, y el navegador sin respuesta.

#### 1. Lista de seguridad de Oracle (obligatorio)

En la consola de Oracle Cloud:

1. *Compute* → *Instances* → tu instancia → pestaña **Networking**
2. Clic en la **subred** (VNIC)
3. **Security Lists** → la lista por defecto → **Add Ingress Rules**

```
Stateless      No
Source Type    CIDR
Source         0.0.0.0/0
IP Protocol    TCP
Source Port    All
Destination Port Range   8088
Description    SIRVE-P
```

Sin esto, nada de lo que hagas dentro del servidor se ve desde fuera.

Si la instancia usa **Network Security Groups** en vez de listas de seguridad,
la regla va ahí, con el mismo contenido.

#### 2. Cortafuegos del servidor

Primero hay que saber cuál está activo:

```bash
sudo systemctl is-active firewalld
sudo iptables -L INPUT -n --line-numbers | head -20
```

**Si `firewalld` está activo** (lo habitual en Oracle Linux 8 y 9):

```bash
sudo firewall-cmd --permanent --add-port=8088/tcp
sudo firewall-cmd --reload
sudo firewall-cmd --list-ports          # debe aparecer 8088/tcp
```

**Si no hay firewalld y se usan reglas de iptables:**

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8088 -j ACCEPT
sudo netfilter-persistent save          # Debian/Ubuntu
# o bien
sudo service iptables save              # Oracle Linux / RHEL
```

El número `6` de la regla es la posición. Debe quedar **antes** de la regla de
rechazo final; si tu `INPUT` tiene otra estructura, mira la numeración y ajusta.

#### 3. Comprobar

Desde el servidor, que Caddy escuche:

```bash
sudo ss -tlnp | grep 8088
```

Desde tu máquina, que responda:

```powershell
curl.exe -i http://140.84.191.170:8088/actuator/health
```

Y para descartar que sea el puerto y no la aplicación:

```powershell
Test-NetConnection -ComputerName 140.84.191.170 -Port 8088
```

`TcpTestSucceeded : False` con el contenedor arriba casi siempre significa que
falta una de las dos reglas.

### La imagen es privada

El paquete de GHCR hereda la visibilidad del repositorio. Para descargarlo, el
servidor necesita autenticarse una vez:

```bash
echo "TU_TOKEN" | docker login ghcr.io -u franciscoalvaradocarreon --password-stdin
```

El token se crea en GitHub → *Settings → Developer settings → Personal access
tokens (classic)* con el permiso `read:packages`. Se guarda en el servidor; no
se versiona ni se comparte.

---

## Primera instalación

### 1. Red compartida con el Caddy del SIH

```bash
docker network create proxy
```

Verificar que el Caddy del SIH esté en ella. Si no lo está, hay que agregarla a
su `docker-compose.yml`:

```yaml
services:
  caddy:
    networks:
      - default
      - proxy
networks:
  proxy:
    external: true
```

Y recrear solo ese servicio: `docker compose up -d caddy`.

### 2. La carpeta del proyecto

```bash
sudo mkdir -p /opt/sirve-p && cd /opt/sirve-p
```

Subir desde tu máquina:

```bash
scp docker-compose.yml usuario@140.84.191.170:/tmp/
scp -r db usuario@140.84.191.170:/tmp/
```

Y en el servidor:

```bash
cd /opt/sirve-p
sudo mv /tmp/docker-compose.yml .
sudo mv /tmp/db .
```

La carpeta `db/` no está en el repositorio: sin ella, Postgres arranca vacío y
la aplicación no encuentra las tablas.

### 3. El archivo `.env`

```bash
sudo nano /opt/sirve-p/.env
```

```ini
DB_NAME=SIRVE
DB_ADMIN_USER=User_app
DB_PASSWORD=<clave de administración de la base>
DB_APP_USER=sirve_app
DB_PASSWORD_APP=<clave del rol de la aplicación>

# La imagen que publicó el pipeline. Ajusta la versión.
IMAGEN_APP=ghcr.io/franciscoalvaradocarreon/sirve:latest
```

Permisos, porque lleva claves:

```bash
sudo chmod 600 /opt/sirve-p/.env
```

### 4. Arrancar

```bash
cd /opt/sirve-p
sudo docker compose pull app
sudo docker compose up -d --no-build
```

La primera vez, el contenedor de la base ejecuta los scripts de `db/` en orden
alfabético y deja el esquema y los catálogos listos. Tarda uno o dos minutos.

```bash
sudo docker compose ps
sudo docker compose logs -f app
```

### 5. El bloque en el Caddyfile del SIH

Editar el Caddyfile del SIH y agregar, al final:

```
:8088 {
	encode gzip zstd

	header {
		X-Content-Type-Options nosniff
		X-Frame-Options SAMEORIGIN
		Referrer-Policy strict-origin-when-cross-origin
	}

	reverse_proxy sirve-p-app-1:8080
}
```

**Validar antes de recargar.** Un Caddyfile mal escrito deja sin servicio también
al SIH, porque comparten el proceso:

```bash
docker exec sih-ia-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec sih-ia-caddy-1 caddy reload   --config /etc/caddy/Caddyfile
```

Si el contenedor tiene otro nombre:

```bash
docker ps --format '{{.Names}}' | grep caddy
```

### 6. Comprobar

```bash
curl -i http://140.84.191.170:8088/actuator/health
curl -s http://140.84.191.170:8088/api/procesos
```

Y en el navegador: `http://140.84.191.170:8088`

---

## Actualizaciones

Cada versión nueva:

```bash
# en tu máquina
git tag v1.0.1
git push origin v1.0.1        # el pipeline publica la imagen

# en el servidor, o desde Actions → Desplegar
cd /opt/sirve-p
sudo docker compose pull app
sudo docker compose up -d --no-build app
```

El despliegue desde GitHub Actions hace lo mismo por SSH, y verifica que la
aplicación responda antes de dar por buena la versión.

---

## Cuando llegue el dominio

1. Registro DNS: tipo `A`, nombre `sirve`, valor `140.84.191.170`.
2. Reemplazar el bloque `:8088` del Caddyfile por:

```
sirve.tudominio.mx {
	encode gzip zstd
	header {
		X-Content-Type-Options nosniff
		X-Frame-Options SAMEORIGIN
		Referrer-Policy strict-origin-when-cross-origin
		Strict-Transport-Security max-age=31536000
	}
	reverse_proxy sirve-p-app-1:8080
}
```

3. `caddy reload`. Caddy pide el certificado solo.
4. Cerrar el 8088 en los dos cortafuegos.

---

## Respaldos

La base vive en el volumen `sirve-p_datos_sirve`. Un respaldo manual:

```bash
docker exec sirve-p-db-1 pg_dump -U User_app -Fc SIRVE > sirve-$(date +%F).dump
```

Y para restaurar:

```bash
cat sirve-2026-11-08.dump | docker exec -i sirve-p-db-1 pg_restore -U User_app -d SIRVE --clean
```
