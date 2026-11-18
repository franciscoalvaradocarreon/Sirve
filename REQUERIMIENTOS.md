# SIRVE-P · Alcance del sistema

Sistema de captura de resultados electorales por casilla, para uso interno de
partido. Este documento describe **lo que el sistema hace hoy**, lo que falta y
lo que se decidió no hacer.

Se escribe desde el sistema, no de memoria: cada punto corresponde a una
pantalla, una ruta del API, una tabla o una decisión registrada.

Última revisión: 18 de noviembre de 2026 · versión en producción **v1.0.5**.

Cómo leerlo:

- **HECHO** — existe y funciona. Entre paréntesis, dónde está.
- **FALTA** — se habló y no se ha hecho.
- **DECIDIDO NO** — se evaluó y se dejó así, con el porqué. Sirve para no
  volver a discutirlo sin contexto.

---

## 1. Alcance del producto

Capturar los votos del acta en la casilla, guardarlos y consultarlos. Nada de
cómputo oficial ni de resultados definitivos: es un sistema de **captura y
consulta**, para uso interno del partido.

Queda fuera, por definición:

```
cómputo distrital o estatal       no es su función
resultados oficiales              los publica la autoridad electoral
padrón electoral                  no se consulta ni se almacena
```

---

## 2. Captura

### Qué hace

```
HECHO
  · una captura por casilla y elección; recapturar reemplaza
    (tabla captura, restricción única)
  · el desglose por opción de boleta vive en captura_voto
  · la suma la calcula el servidor, nunca el cliente
  · la aritmética no bloquea: si no cuadra se guarda con aritmetica_ok = false
    y su diferencia. El acta manda.
  · el registro guarda quién capturó, desde qué dispositivo y con qué origen
    (APP, PORTAL, IMPORTACION)
  · pantalla de captura en escritorio            (/captura)
  · captura en el teléfono con cola sin conexión  (/movil)
  · copia local del borrador en el teléfono, por casilla
  · «Limpiar cifras» con confirmación, para empezar de cero
```

### Pendiente

```
FALTA
  · reintento visible de fotos pendientes en el teléfono
  · validación del contenido de la foto (hoy se acepta cualquier archivo como .jpg)
  · cuota de disco por capturista: hoy un pase válido puede llenar el volumen
  · pantalla «Consultar captura» existe pero está vacía (/captura/consulta)
```

---

## 3. Fotos de acta

```
HECHO
  · subida desde el teléfono con pase del dispositivo
  · guardado en volumen propio: /var/lib/docker/volumes/sirve-p_actas/_data
  · nombre <año>/<año>-<ELEC>-<MUN>-<sección>-<tipo>.jpg, saneado
  · escritura atómica: primero .tmp, luego el nombre definitivo
  · metadatos en tabla acta_foto (casilla, elección, ruta, bytes, quién)
  · galería en escritorio con navegación y descarga   (/reportes/actas)
  · imagen servida sin cabeceras, porque un <img> no las manda
```

```
DECIDIDO NO
  · exigir firma en la dirección de la imagen
    Se evaluó: hoy la dirección es predecible y cualquiera puede descargar las
    33 000 actas con un script. Se decidió dejarlo abierto mientras no se pueda
    BORRAR, que es el riesgo que importaba. No existe ruta de borrado.
  · cerrar la lectura de metadatos sin sesión
    Ya está cerrada: /api/actas/{casilla}/{eleccion} responde 401 sin sesión.
```

---

## 4. Teléfonos y enrolamiento

```
HECHO
  · código de enrolamiento de 8 caracteres, generado con SecureRandom
  · vigencia de 3 horas, configurable            (Parámetros)
  · el código se guarda como hash; el valor en claro nunca llega a la base
  · al enrolar, el teléfono recibe un pase de 32 bytes aleatorios (256 bits)
  · el pase también se guarda como hash
  · reemitir un código renueva su caducidad
  · desactivar un teléfono corta el acceso
  · cada petición con pase actualiza ultimo_uso
```

```
FALTA
  · caducidad del pase por inactividad: hoy un teléfono enrolado conserva su
    pase indefinidamente hasta que alguien lo desactive
  · 299 de los 301 capturistas no tienen teléfono enrolado
```

---

## 5. Capturistas y asignación

```
HECHO
  · alta individual                     (/capturistas/nuevo)
  · importación masiva desde CSV        (/capturistas/importar)
    301 capturistas importados, todos con secciones (3 010 asignaciones)
  · asignación de secciones por capturista
  · listado de teléfonos por capturista, con su estado
  · reporte de asignación               (/reportes/asignacion)
```

---

## 6. Catálogos

```
HECHO
  · procesos y elecciones                 (/catalogos/procesos, /elecciones)
  · municipios, distritos, secciones      (/catalogos/municipios, /distritos, /secciones)
  · casillas                              (/catalogos/casillas)
  · partidos, con color y logo            (/catalogos/partidos)
  · coaliciones, con integrantes          (/catalogos/coaliciones)
  · boletas por elección: qué opciones van, en qué orden, con color y logo
    y activar o desactivar                (/catalogos/boletas)
```

```
HECHO, reglas que protegen los datos
  · una opción con votos capturados no se borra: se desactiva
  · la clave de una opción no se cambia después de crear
  · el orden se mueve con flechas, no escribiendo el número
    (el orden es único por elección; escribirlo choca con la restricción)
```

```
FALTA
  · PAZ y SOMOS están en el catálogo de partidos pero no en ninguna boleta
    (se puede hacer ya, desde la pantalla de boletas)
```

```
DECIDIDO NO
  · logos de las cinco coaliciones. Se dejó así por lo pronto.
```

---

## 7. Usuarios, roles y permisos

```
HECHO
  · seis roles: ADMIN, COORDINADOR, OPERADOR, ANALISTA, AUDITOR, REPRESENTANTE
  · contraseñas con BCrypt coste 12
  · sesión con JWT, 12 horas, invalidable al cerrar sesión
  · el token se invalida también al cambiar la contraseña
  · matriz de menús por rol              (/usuarios/menus)
  · EL PERMISO SALE DEL MENÚ: lo que el rol tiene concedido es lo que alcanza
    en el API. Conceder abre la ruta; quitar la cierra. Con caché que se limpia
    al guardar la matriz.
  · editar la matriz es solo del administrador, a propósito: si se pudiera
    delegar, un rol con el menú de usuarios podría concederse todos los demás
```

```
HECHO, roles
  · Representante: ve actas y avance. No captura, no administra, no entra al
    tablero de operación ni a la asignación. Solo escritorio.
```

```
FALTA
  · bloqueo de cuenta por intentos fallidos (hoy el límite es por IP:
    12 intentos por minuto y después 429)
```

```
DECIDIDO NO
  · contraseñas de 12 caracteres con complejidad. Se decidió dejarlas en 8
    caracteres. La protección real es el límite de intentos.
  · cambio de contraseña por el propio usuario. Se quitó de la barra; solo el
    administrador restablece contraseñas desde Usuarios.
```

---

## 8. Reportes y sala

```
HECHO
  · operación: avance por municipio, ritmo de captura, atrasadas, descuadradas
                                          (/reportes/operacion)
  · avance                                (/reportes/avance)
  · asignación                            (/reportes/asignacion)
  · actas (galería)                       (/reportes/actas)
  · sala de resultados, pública y sin sesión   (/sala)
    con tablero por elección y alcance (estado, distrito, municipio)
```

```
FALTA
  · conteo rápido, si se llega a necesitar
```

---

## 9. Operación del servidor

```
HECHO
  · SIRVE y SIH conviven en el mismo servidor, cada uno con su contenedor
  · TLS con certificado propio por dominio      https://sirve.140.84.191.170.sslip.io
  · el 80 redirige a 443
  · cabeceras de seguridad: HSTS, CSP, X-Frame-Options, X-Content-Type-Options,
    Referrer-Policy, Permissions-Policy        (solo en el bloque de SIRVE)
  · /actuator responde 404 hacia fuera; la salud se consulta desde dentro
  · la base solo escucha en 127.0.0.1:5433 (túnel SSH para administrarla)
  · el 8088 quedó atado a 127.0.0.1: dejó de publicarse sin cifrar
  · SSH solo con llave, contraseña deshabilitada
  · firewalld activo; Docker lo esquiva en los puertos que publica
  · aviso de disco al 80 % por correo y webhook, cada 6 horas como mucho
  · respaldo de base y actas a un bucket de OCI
  · despliegue por etiqueta: la versión queda escrita en el .env
  · servidor en Oracle Linux 9.9, kernel 6.12, sin parches pendientes
```

```
FALTA
  · aviso si falla el respaldo
  · aviso si un sitio deja de responder (el SIH estuvo 7 horas caído sin aviso)
  · verificar si el bucket de respaldos es privado
  · actualizar las imágenes base de los contenedores (postgres y caddy llevan
    dos meses fijas)
```

```
DECIDIDO NO
  · dominio propio. Se usa sslip.io, que es de terceros. Si se compra un
    dominio, el APK hay que recompilarlo y se publica assetlinks.json.
```

---

## 10. Aplicación del teléfono (APK)

```
HECHO
  · APK propio, paquete mx.sirve.captura, nombre SIRVE
  · abre /movil a pantalla completa, sin barra de navegación
  · selector de foto resuelto por la app (cámara y galería)
  · sigue el modo oscuro del teléfono
  · distribución por sideload, firmado con llave propia
```

```
DECIDIDO NO
  · TWA (Trusted Web Activity). Requiere JDK 17 interactivo y Gradle
    compatible, que no había en el equipo. El APK actual es un WebView.
```

---

## 11. Decisiones de datos

```
· Sin funciones ni disparadores en la base: la integridad se sostiene con
  llaves, restricciones y el orden de las operaciones.
· Una captura por casilla y elección: recapturar reemplaza, no hay historial.
· Los distritos son de la sección, no de la casilla.
· Los datos de prueba actuales (16 536 capturas, 8 262 actas) se conservan
  para demostraciones. Se limpian cerca de la jornada.
```

---

## 12. Lo que falta antes de la jornada

En orden de urgencia, según lo hablado:

```
1. limpiar los datos de prueba          905 MB y el tablero al 100 % falso
2. decidir el espacio: ampliar el volumen o comprimir las fotos a 1400 px
   Hoy: 9.2 GB libres. Cuatro elecciones con fotos reales piden ~9.5 GB.
3. enrolar los 299 teléfonos restantes
4. aviso si falla el respaldo
5. aviso si un sitio no responde
6. PAZ y SOMOS en las boletas
```

---

## 13. Historial de este documento

Este documento se creó el 18 de noviembre de 2026 porque el alcance vivía en la
conversación y en los commits. Se actualiza cuando cambie el alcance, no cuando
cambie el código.

La correspondencia de versiones anteriores está en `HISTORIAL-VERSIONES.md`.

La comparación con el análisis inicial —lo que la especificación pide y cuánto
de eso está construido— está en `CONTRASTE-ANALISIS.md`.
