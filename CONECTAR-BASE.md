# Conectar a la base desde DBeaver

La base **no está expuesta a Internet**: PostgreSQL escucha solo en la loopback
del servidor (`127.0.0.1:5433`). Se entra con un túnel SSH, que DBeaver sabe
hacer.

## Datos

### Pestaña «Main»

| campo | valor |
|---|---|
| Host | `127.0.0.1` |
| Port | `5433` |
| Database | `SIRVE` |
| Username | `sirve_app` |
| Password | la de `DB_PASSWORD_APP` en `/opt/sirve-p/.env` |

`127.0.0.1` parece raro, pero es lo correcto: con el túnel, esa dirección se
resuelve **en el servidor**, no en tu equipo.

### Pestaña «SSH»

| campo | valor |
|---|---|
| Host/IP | `159.54.142.97` |
| Port | `22` |
| User Name | `ubuntu` |
| Authentication | Public Key |
| Private key | `C:\Users\USER\.ssh\sih_oracle_ed25519` |

La llave no tiene contraseña, así que no pide nada al conectar. Botón
**Test tunnel** para comprobarla antes de guardar.

### Pestaña «Driver properties»

Si la conexión tarda en caer, agregar:

```
connectTimeout = 10
```

---

## Qué usuario usar

| usuario | para qué |
|---|---|
| `sirve_app` | **lo normal**. Lee y escribe; no puede alterar el esquema. Es el que usa la aplicación. |
| `User_app` | mantenimiento: restaurar, migrar, crear objetos. Es el dueño de todo. |

Para mirar tablas, `sirve_app`. Para correr una migración, `User_app`.

Ojo: los dos pueden **borrar datos**. DBeaver tiene autocommit encendido por
defecto; para trabajar con cuidado, apagarlo y confirmar a mano.

---

## Las claves

Están en el servidor:

```bash
sudo grep -E '^DB_PASSWORD' /opt/sirve-p/.env
```

```
DB_PASSWORD       la de User_app
DB_PASSWORD_APP   la de sirve_app
```

---

## Por qué la base no se publica de otra forma

```
127.0.0.1:5433:5432     ✓ lo que hay: solo desde dentro del servidor
0.0.0.0:5433:5432       ✗ expone PostgreSQL a Internet
5432:5432               ✗ igual, y además choca con la base del SIH
```

El override que lo hace vive en `/opt/sirve-p/docker-compose.override.yml`,
fuera del repositorio.

**Detalle que costó una hora**: la base está en `sirve-p_interna`, que está
declarada `internal: true`, y Docker **no publica puertos de contenedores que
solo viven en una red interna**. Por eso el override también la pone en la red
normal del proyecto:

```yaml
services:
  db:
    ports:
      - "127.0.0.1:5433:5432"
    networks:
      - interna
      - default
```

Si algún día se toca ese archivo, el síntoma es que `docker port` no muestra
nada y DBeaver dice «connection refused».

---

## Alternativa sin DBeaver

Un túnel desde la terminal, y luego cualquier cliente:

```bash
ssh -i C:\Users\USER\.ssh\sih_oracle_ed25519 -N -L 5433:127.0.0.1:5433 ubuntu@159.54.142.97
```

Con eso, `localhost:5433` en tu equipo es la base del servidor hasta que cortes
la sesión.
