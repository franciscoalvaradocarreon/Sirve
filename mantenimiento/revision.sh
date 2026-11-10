#!/usr/bin/env bash
# ============================================================================
# SIRVE-P · Revisión mensual del servidor
#
# No cambia nada: solo mira y reporta. Lo que salga marcado con ⚠ se atiende
# después, a mano y con calma.
#
#     sudo /opt/sirve-p/mantenimiento/revision.sh
#
# Conviene correrla el mismo día del mes, antes de aplicar parches, para tener
# una foto de cómo estaba todo antes de tocar nada.
# ============================================================================
set -uo pipefail

CONTENEDOR_APP="sirve-p-app-1"
CONTENEDOR_DB="sirve-p-db-1"
RESPALDOS="/opt/respaldos/sirve"

titulo() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()     { printf '  ✓ %s\n' "$*"; }
ojo()    { printf '  ⚠ %s\n' "$*"; }
dato()   { printf '  · %s\n' "$*"; }

# --- sistema ----------------------------------------------------------------
titulo "Sistema"
dato "$(grep -E '^PRETTY_NAME=' /etc/os-release | cut -d'"' -f2) · $(uname -r)"
dato "encendido desde: $(uptime -s) (hace $(uptime -p | sed 's/^up //'))"

PARCHE_SEG=$(sudo -n dnf -q updateinfo list security 2>/dev/null | wc -l)
PARCHE_TOT=$(sudo -n dnf -q check-update 2>/dev/null | grep -c '^[a-zA-Z0-9]' || true)
if [ "$PARCHE_SEG" -gt 0 ]; then
    ojo "$PARCHE_SEG parches de seguridad pendientes (de $PARCHE_TOT en total)"
elif [ "$PARCHE_TOT" -gt 0 ]; then
    ojo "$PARCHE_TOT parches pendientes, ninguno marcado como seguridad"
else
    ok "sin parches pendientes"
fi

# Reinicio pendiente por actualización de kernel
if [ -f /var/run/reboot-required ]; then
    ojo "hay un reinicio pendiente"
fi

# --- disco y memoria --------------------------------------------------------
titulo "Recursos"
USO_DISCO=$(df --output=pcent / | tail -1 | tr -dc '0-9')
dato "disco raíz: ${USO_DISCO}% usado · $(df -h / | tail -1 | awk '{print $4}') libres"
[ "$USO_DISCO" -ge 80 ] && ojo "el disco pasa del 80%"

dato "memoria: $(free -h | awk '/^Mem:/{print $3" de "$2" en uso"}')"
LIBRE_MB=$(free -m | awk '/^Mem:/{print $7}')
[ "$LIBRE_MB" -lt 1024 ] && ojo "queda menos de 1 GB de memoria disponible"

# --- contenedores -----------------------------------------------------------
titulo "Contenedores"
for c in "$CONTENEDOR_APP" "$CONTENEDOR_DB"; do
    ESTADO=$(sudo -n docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo "no existe")
    IMAGEN=$(sudo -n docker inspect -f '{{.Config.Image}}' "$c" 2>/dev/null || echo "-")
    if [ "$ESTADO" = "running" ]; then
        ok "$c · $ESTADO · $IMAGEN"
    else
        ojo "$c · $ESTADO"
    fi
done

# Antigüedad de las imágenes base: si tienen meses, toca reconstruir
titulo "Imágenes base"
for img in postgres:17-alpine eclipse-temurin:21-jre-alpine; do
    CREADA=$(sudo -n docker image inspect -f '{{.Created}}' "$img" 2>/dev/null | cut -dT -f1)
    if [ -n "$CREADA" ]; then
        DIAS=$(( ( $(date +%s) - $(date -d "$CREADA" +%s) ) / 86400 ))
        if [ "$DIAS" -gt 90 ]; then
            ojo "$img · creada hace $DIAS días · reconstruir con --pull"
        else
            dato "$img · creada hace $DIAS días"
        fi
    else
        ojo "$img · no está en el servidor"
    fi
done

# --- base de datos ----------------------------------------------------------
titulo "Base de datos"
TABLAS=$(sudo -n docker exec "$CONTENEDOR_DB" psql -U User_app -d SIRVE -tAc \
    "select count(*) from information_schema.tables where table_schema='sirve'" 2>/dev/null)
CAPTURAS=$(sudo -n docker exec "$CONTENEDOR_DB" psql -U User_app -d SIRVE -tAc \
    "select count(*) from sirve.captura" 2>/dev/null)
TAMANO=$(sudo -n docker exec "$CONTENEDOR_DB" psql -U User_app -d SIRVE -tAc \
    "select pg_size_pretty(pg_database_size('SIRVE'))" 2>/dev/null)
dato "tablas en el esquema sirve: ${TABLAS:-?}"
dato "capturas: ${CAPTURAS:-?} · tamaño: ${TAMANO:-?}"

# Conexiones abiertas: si crecen sin control, algo no cierra
CONEX=$(sudo -n docker exec "$CONTENEDOR_DB" psql -U User_app -d SIRVE -tAc \
    "select count(*) from pg_stat_activity where datname='SIRVE'" 2>/dev/null)
dato "conexiones abiertas: ${CONEX:-?}"

# --- respaldos --------------------------------------------------------------
titulo "Respaldos"
if [ -d "$RESPALDOS" ]; then
    ULTIMO=$(ls -t "$RESPALDOS"/*.dump 2>/dev/null | head -1)
    if [ -n "$ULTIMO" ]; then
        DIAS=$(( ( $(date +%s) - $(stat -c %Y "$ULTIMO") ) / 86400 ))
        if [ "$DIAS" -gt 2 ]; then
            ojo "el último respaldo es de hace $DIAS días: $(basename "$ULTIMO")"
        else
            ok "último respaldo: $(basename "$ULTIMO") ($(du -h "$ULTIMO" | cut -f1))"
        fi
    else
        ojo "no hay ningún respaldo en $RESPALDOS"
    fi
    dato "en total: $(find "$RESPALDOS" -name '*.dump' | wc -l) archivos · $(du -sh "$RESPALDOS" | cut -f1)"

    if [ -f /var/log/sirve-respaldo.log ]; then
        # grep -c imprime 0 y devuelve 1 cuando no encuentra nada, así que no
        # se le puede encadenar «|| echo 0»: quedaría «0» dos veces.
        FALLOS=$(sudo -n grep -c 'ERROR' /var/log/sirve-respaldo.log 2>/dev/null)
        FALLOS=${FALLOS:-0}
        if [ "$FALLOS" -gt 0 ]; then
            ojo "$FALLOS errores en el registro de respaldos"
        else
            ok "sin errores en el registro de respaldos"
        fi
    fi

    # Copia fuera del servidor: hoy no existe, y sin ella el respaldo no
    # protege de perder la máquina.
    ojo "los respaldos viven en este mismo servidor: no hay copia externa"
else
    ojo "no existe $RESPALDOS"
fi

# --- aplicación -------------------------------------------------------------
titulo "Aplicación"
SALUD=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:8088/actuator/health/liveness)
[ "$SALUD" = "200" ] && ok "responde en 127.0.0.1:8088" || ojo "no responde: código $SALUD"

API_MS=$(curl -s -o /dev/null -w '%{time_total}' --max-time 10 http://127.0.0.1:8088/api/procesos)
dato "consulta de catálogos: ${API_MS}s"

ERRORES=$(sudo -n docker logs --since 24h "$CONTENEDOR_APP" 2>&1 | grep -c 'ERROR' || true)
[ "$ERRORES" -gt 0 ] && ojo "$ERRORES líneas con ERROR en las últimas 24 h" \
                     || ok "sin errores en el registro de las últimas 24 h"

# --- puertos ----------------------------------------------------------------
titulo "Puertos a la escucha"
for p in 22 80 443 8088 5433; do
    if ss -tln 2>/dev/null | grep -q ":$p "; then
        dato "$p abierto"
    fi
done
if ss -tln 2>/dev/null | grep -q '0.0.0.0:5433'; then
    ojo "la base está publicada en 0.0.0.0:5433; debería escuchar solo en 127.0.0.1"
else
    ok "la base no está expuesta fuera de la máquina"
fi

printf '\n'
