# Mantenimiento mensual

Una revisión al mes, el mismo día, antes de aplicar parches. La idea es tener
una foto de cómo estaba todo **antes** de tocar nada.

Servidor: **159.54.142.97** · Ubuntu 24.04 · 2 vCPU · 952 MB · 48 GB.

> El servidor anterior era Oracle Linux y tenía 22 GB de RAM. Todo lo de abajo
> está escrito para este: los paquetes se miran con `apt` y el margen de
> memoria es corto, así que se vigila la swap.

---

## 1. La foto de partida

```bash
sudo bash /opt/sirve-p/mantenimiento/revision.sh
```

No cambia nada: solo mira y reporta. Guarda la salida —sirve para comparar con
el mes anterior— o al menos mira si aparece algún ⚠.

Lo que revisa: parches, reinicio pendiente, disco, memoria y swap, estado y
consumo de los contenedores, versión desplegada, respuesta por HTTPS, que
actuator siga cerrado, capturas y actas registradas, fotos en disco, planos,
el temporizador del respaldo, el estado que dejó en el bucket, qué puertos
escuchan y si el proxy está en la red compartida.

---

## 2. Parches del sistema

Los comparte con el SIH: es la misma máquina.

```bash
sudo apt update
apt list --upgradable | wc -l
apt list --upgradable | grep -ci security
```

Si hay parches de seguridad, se aplican en una ventana:

```bash
sudo apt update && sudo apt upgrade -y
```

**Antes de actualizar**, dos cosas:

1. Respaldo fresco: `sudo systemctl start sirve-respaldo.service`
2. Avisar a quien use el SIH: si el kernel cambia, hay que reiniciar.

Si el kernel se actualizó, el reinicio es obligatorio:

```bash
[ -f /var/run/reboot-required ] && echo "hace falta reiniciar"
sudo reboot
```

Los dos sistemas vuelven solos: los contenedores tienen `restart: unless-stopped`
y Docker está habilitado al arranque. Después del reinicio, volver a correr la
revisión y comprobar los dos dominios.

**Nunca en la semana de una jornada electoral.**

---

## 3. La imagen de la aplicación

La imagen ya no se construye aquí: se construye en GitHub y el servidor la
descarga. Eso significa dos cosas distintas que conviene no confundir.

**Actualizar la aplicación** es desplegar una versión nueva:

```bash
git tag -a v2.0.2 -m "…" && git push origin v2.0.2
gh workflow run cd.yml -f version=v2.0.2
```

**Actualizar las imágenes base** —Node, Eclipse Temurin, Alpine— pasa solo, con
la siguiente construcción: el flujo las baja de nuevo cada vez. Si hace meses
que no se despliega nada, conviene lanzar una versión aunque no haya cambios:
arrastra parches de las tres etapas.

```bash
# ver cuánto llevan sin actualizarse las que están en uso
sudo docker image inspect -f '{{.Created}}' postgres:17-alpine caddy:2-alpine
```

La de PostgreSQL y la del proxy sí se bajan aquí:

```bash
cd /opt/sih   && sudo docker compose pull caddy db && sudo docker compose up -d caddy db
cd /opt/sirve-p && sudo docker compose pull db && sudo docker compose up -d db
```

Un `pull` de la base trae la versión menor vigente de PostgreSQL 17; el
volumen no se toca. **Con una jornada cerca, no hacerlo**: una versión menor
nueva es un cambio que no hace falta arriesgar.

---

## 4. Dependencias

En el servidor ya casi no hay: la aplicación vive dentro de la imagen. Lo que
queda es lo que corre fuera de Docker.

```bash
/home/ubuntu/oci-venv/bin/pip install --upgrade oci-cli    # CLI de respaldos
docker --version                                          # motor
```

El CLI de Oracle está en un *venv* a propósito: los paquetes de Ubuntu y los de
`pip` chocan, y ya pasó al instalarlo.

---

## 5. Respaldos

Corren solos todas las noches.

```bash
sudo systemctl list-timers sirve-respaldo.timer
sudo journalctl -u sirve-respaldo -n 20 --no-pager
```

Lo que se genera:

```
sirve/base/sirve-<fecha>.dump      la base, cada noche
sih/base/sih-<fecha>.dump          la del SIH
sirve/actas/<año>/…                solo las fotos que falten
sirve/estado/respaldo.json         cuándo corrió y si falló
```

**No se guarda nada en el servidor**: los volcados se escriben en `/dev/shm`,
que es memoria, y se borran al terminar la subida. Se conservan 30 días de
volcados; las actas no se borran nunca.

### Cada mes, mirar tres cosas

```bash
# 1. que el temporizador siga armado y su última corrida haya ido bien
sudo systemctl list-timers sirve-respaldo.timer
sudo journalctl -u sirve-respaldo -n 5 --no-pager

# 2. que el estado en el bucket sea de ayer
/home/ubuntu/oci-venv/bin/oci os object get --auth instance_principal \
  --region mx-queretaro-1 --bucket-name sirve-sih-respaldos \
  --name "sirve/estado/respaldo.json" --file /dev/stdout

# 3. cuántos volcados hay y cuánto ocupan (el bucket gratuito son 20 GB)
/home/ubuntu/oci-venv/bin/oci os object list --auth instance_principal \
  --region mx-queretaro-1 --bucket-name sirve-sih-respaldos --prefix "sirve/base/" \
  --all --query 'length(data)'
```

### Cada tres meses, restaurar de verdad

Un respaldo que nunca se restauró no es un respaldo. Hay un guion que lo hace
todo y no toca producción:

```bash
sudo bash /opt/sirve-p/mantenimiento/probar-restauracion.sh
echo $?        # 0 = el respaldo restaura completo
```

Qué hace: baja el volcado más reciente del bucket, crea una base aparte
(`prueba_restore`), restaura, compara **18 cosas** contra producción y borra la
base y el volcado temporal.

No compara solo conteos: también **huellas del contenido** (md5 sobre las filas
ordenadas de capturas, actas y casillas). Dos bases con los mismos números
pueden tener datos distintos; la huella lo descarta.

```
  tabla                     producción   restaurada  resultado
  capturas                        23928        23928  ✓
  suma de votos                 7391187      7391187  ✓
  renglones de voto              273066       273066  ✓
  huella de capturas       6c9cc7916dfe… 6c9cc7916dfe…  ✓
  huella de actas          eb4dc360341e… eb4dc360341e…  ✓
  …
  RESULTADO: el respaldo restaura completo · 23 s
```

Si alguna línea sale con ✗, el respaldo no sirve y hay que averiguar por qué
**antes** de necesitarlo. La primera vez que se corrió, tres líneas fallaron:
no era el respaldo, eran consultas mías contra columnas que no existen
(`tamano` en vez de `bytes`, `voto` en vez de `captura_voto`).

### Si el respaldo deja de subir

Casi siempre es la identidad con el bucket: el servidor no usa llaves, usa el
grupo dinámico `sirve-respaldos-dg`, y su regla tiene el OCID de la instancia.
Si se recreó la instancia, **el OCID es otro** y hay que agregarlo.

El síntoma es engañoso: `oci os object list` responde «no existe o no estás
autorizado», que suena a bucket borrado y no a permiso.

---

## 6. Espacio y limpieza

```bash
df -h /
sudo docker system df
```

Estado con los datos de la migración:

```
disco            10 GB de 48 · 38 libres
planos           355 MB · 3 114 archivos
actas            905 MB · 8 268 fotos (hoy son 4 imágenes repetidas: dato de prueba)
base de SIRVE    63 MB
```

Si el disco pasa del 80 %:

```bash
sudo docker image prune -a --filter "until=720h"   # imágenes de más de 30 días
sudo journalctl --vacuum-time=30d                  # registros del sistema
```

Los volcados no ocupan disco aquí: se van al bucket y se borran del servidor.
Lo que crece son las actas, y eso **no se borra**.

Con fotos reales, una elección completa se calcula entre 1.5 y 2.5 GB. Si algún
día no alcanza, el nivel gratuito de OCI incluye 200 GB de almacenamiento en
bloque y este servidor solo usa 48.

---

## 7. Memoria

Es el recurso escaso: 952 MB para los dos sistemas.

```bash
free -m
sudo docker stats --no-stream
```

Los límites están puestos a propósito:

```
app    420 MB de tope, heap de 192 MB, recolector serial
base   256 MB, shared_buffers de 48 MB, 30 conexiones
proxy   96 MB
```

Si la revisión marca **swap en uso por encima de 400 MB**, los dos sistemas
están apretados. Tres salidas, en orden:

1. apagar el que no se use: `sudo /opt/sirve-p/modo.sh sih` (o `sirve`)
2. bajar el heap: `HEAP_APP=128m` en el `.env` y reiniciar la aplicación
3. agregar memoria: cambiar la forma de la instancia en OCI

---

## 8. Seguridad

- **Puertos**: solo 22, 80 y 443 desde fuera. La base y la aplicación **no
  publican puertos**: si aparece un 5432, 8080 u 8088 escuchando, algo se
  cambió en el compose.
- **Claves**: el `.env` con permisos `600`, y `chmod 600` en el archivo de la
  contraseña del keystore.
- **Actuator**: `https://<dominio>/actuator/health` tiene que devolver **404**.
  La revisión lo comprueba.
- **Imagen en GHCR**: el paquete es privado; el servidor entra con el token de
  la corrida. Si algún día se hace público, cualquiera puede descargarla.
- **Keystore del APK**: `apk/sirve/sirve-release-2026.keystore` y su
  contraseña. Perderlos obliga a firmar con otra llave y a desinstalar en cada
  teléfono. Deben estar en el bucket y en una memoria física, no solo en un
  equipo.
- **Copia externa**: el respaldo del bucket vive en la misma cuenta de OCI. Si
  se pierde la cuenta, se pierde todo. Un volcado mensual en otro lado —una
  memoria, otro proveedor— cubre ese hueco.

---

## 9. Lo que se revisa solo

```
respaldo            cada noche, 03:00 de Monterrey
certificados TLS    Caddy los renueva solo
contenedores        vuelven solos al reiniciar (unless-stopped)
planos              estáticos; se regeneran con cartografia/generar-planos.py
```

---

## 10. Registro

Anota cada revisión. Sin esto, el mes siguiente nadie recuerda qué se hizo.

| Fecha | Parches | Imágenes | Dependencias | Notas |
|---|---|---|---|---|
| 2026-11-10 | 0 pendientes | postgres 54 días, temurin 5 días | sin revisar | Instalación inicial del respaldo y la revisión |
| 2026-11-23 | 14 pendientes, 0 de seguridad · reinicio pendiente | app v2.0.1 · postgres y caddy al día | oci-cli 3.96.3 | Migración al servidor nuevo: 8 268 actas restauradas, planos regenerados, respaldo directo al bucket. Swap en uso: 736 MB |

---

## Lo que no se hace

- **No actualizar en la semana de una jornada electoral.**
- **No reiniciar sin respaldo fresco.**
- **No actualizar todo a la vez**: si algo se rompe, no sabrás qué fue.
- **No borrar actas para liberar disco.** Es el único dato que no se puede
  regenerar.
