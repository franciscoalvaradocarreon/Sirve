# Mantenimiento mensual

Revisión de media hora, una vez al mes. El objetivo no es actualizar por
actualizar: es que nada se acumule durante un año y luego haya que hacerlo todo
la víspera de una jornada.

**Primer lunes del mes, por la mañana.**

---

## 1. La foto de partida

```bash
sudo /opt/sirve-p/mantenimiento/revision.sh
```

No cambia nada: solo mira y reporta. Guarda la salida —sirve para comparar con
el mes anterior— o al menos mira si aparece algún ⚠.

Lo que revisa: parches del sistema, disco, memoria, estado de los contenedores,
antigüedad de las imágenes base, tamaño de la base y de los respaldos,
conexiones abiertas, salud de la aplicación, errores en los registros y qué
puertos escuchan.

---

## 2. Parches del sistema

Los comparte con el SIH: es la misma máquina.

```bash
sudo dnf check-update
sudo dnf updateinfo list security | wc -l
```

Si hay parches de seguridad, se aplican en una ventana:

```bash
sudo dnf update -y --security
sudo dnf update -y
```

**Antes de actualizar**, dos cosas:

1. Respaldo fresco: `sudo /opt/sirve-p/respaldos/respaldo.sh`
2. Avisar a quien use el SIH: si el kernel cambia, hay que reiniciar.

Si el kernel se actualizó, el reinicio es obligatorio para que aplique. Los dos
sistemas vuelven solos: los contenedores tienen `restart: unless-stopped`.
Aun así, después del reinicio:

```bash
sudo /opt/sirve-p/mantenimiento/revision.sh
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8088/
```

---

## 3. Imágenes base

Las imágenes de Docker traen sus propios paquetes. Envejecen aunque no
despliegues nada.

```bash
cd /opt/sirve-p
sudo -n docker compose build --pull app
sudo -n docker compose up -d --no-build app
```

`--pull` obliga a bajar la versión vigente de `eclipse-temurin:21-jre-alpine` y
de `node:22-alpine`. Sin él, Docker reutiliza la que ya tiene.

Para la base:

```bash
sudo docker pull postgres:17-alpine
sudo -n docker compose up -d db      # recrea el contenedor, el volumen no se toca
```

**El volumen no se pierde** al recrear el contenedor: los datos viven fuera.

---

## 4. Dependencias

Desde tu máquina, no en el servidor:

```powershell
cd D:\proyectos\SIRVE\FrontendReact
npm outdated

cd ..\BackendJava
mvn versions:display-dependency-updates
```

No hay que subir todo. Lo que importa:

- **Spring Boot** y el **driver de PostgreSQL**: parches de seguridad.
- **React** y **Vite**: mejoras y correcciones.
- Lo demás, cuando haya motivo.

Cada actualización pasa por el CI: si compila, los tipos cuadran y el esquema
instala en limpio, es segura. Si algo se rompe, se ve antes de tocar producción.

**Nunca en la semana de una jornada electoral.**

---

## 5. Respaldos

Cada mes:

```bash
ls -lh /opt/respaldos/sirve/ | tail -5
sudo tail -5 /var/log/sirve-respaldo.log
```

Cada **tres meses**, restaurar de verdad. Un respaldo que nunca se restauró no
es un respaldo:

```bash
ARCHIVO=$(ls -t /opt/respaldos/sirve/*.dump | head -1)
docker exec sirve-p-db-1 psql -U User_app -d postgres -c 'CREATE DATABASE prueba_restore;'
docker exec -i sirve-p-db-1 pg_restore -U User_app -d prueba_restore --no-owner --no-privileges < "$ARCHIVO"
docker exec sirve-p-db-1 psql -U User_app -d prueba_restore -c 'select count(*) from sirve.captura;'
docker exec sirve-p-db-1 psql -U User_app -d postgres -c 'DROP DATABASE prueba_restore;'
```

El número debe coincidir con el de producción.

---

## 6. Espacio y limpieza

```bash
df -h /
sudo docker system df
```

Si el disco pasa del 80 %:

```bash
sudo docker image prune -a --filter "until=720h"   # imágenes de más de 30 días
sudo journalctl --vacuum-time=30d                  # registros del sistema
```

Los respaldos ya se limpian solos a los 14 días.

---

## 7. Seguridad

- **Puertos**: solo 22, 80, 443 y 8088 deben verse desde fuera. El 5433 tiene
  que escuchar únicamente en `127.0.0.1`.
- **Claves**: revisar que `.env` siga con permisos `600`.
- **Imagen de GHCR**: si algún día se hace pública, cualquiera puede descargarla.
- **Respaldos fuera del servidor**: hoy no existen. Es la carencia más grande de
  toda la instalación.

---

## 8. Registro

Anota cada revisión. Sin esto, el mes siguiente nadie recuerda qué se hizo.

| Fecha | Parches | Imágenes | Dependencias | Notas |
|---|---|---|---|---|
| 2026-11-10 | 0 pendientes | postgres 54 días, temurin 5 días | sin revisar | Instalación inicial del respaldo y la revisión |

---

## Lo que no se hace

- **No actualizar en la semana de una jornada electoral.**
- **No reiniciar sin respaldo fresco.**
- **No actualizar todo a la vez**: si algo se rompe, no sabrás qué fue.
