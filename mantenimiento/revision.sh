#!/usr/bin/env bash
# ============================================================================
# SIRVE-P · Revisión mensual del servidor
#
# No cambia nada: solo mira y reporta. Lo que salga marcado con ⚠ se atiende
# después, a mano y con calma.
#
#     sudo bash /opt/sirve-p/mantenimiento/revision.sh
#
# Conviene correrla el mismo día del mes, antes de aplicar parches, para tener
# una foto de cómo estaba todo antes de tocar nada.
#
# El servidor es Ubuntu: los parches se miran con apt, no con dnf. La base y la
# aplicación no publican puertos; solo el proxy escucha desde fuera.
# ============================================================================
set -uo pipefail

APP="sirve-p-app-1"
DB="sirve-p-db-1"
CADDY="sih-ia-caddy-1"
VOL_ACTAS="/var/lib/docker/volumes/sirve-p_actas/_data"
PLANOS="/opt/sirve-p/planos"
DOMINIO="sirve.159.54.142.97.sslip.io"
OCI=/home/ubuntu/oci-venv/bin/oci

titulo() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()     { printf '  ✓ %s\n' "$*"; }
ojo()    { printf '  ⚠ %s\n' "$*"; }
dato()   { printf '  · %s\n' "$*"; }

# --- sistema ----------------------------------------------------------------
titulo "Sistema"
dato "$(grep -E '^PRETTY_NAME=' /etc/os-release | cut -d'"' -f2) · $(uname -r) · $(uname -m)"
dato "encendido desde $(uptime -s) · carga: $(cut -d' ' -f1-3 /proc/loadavg)"
dato "$(nproc) vCPU · $(free -m | awk '/^Mem:/{print $2}') MB de RAM"

PARCHE_TOT=$(apt list --upgradable 2>/dev/null | grep -c '^[a-z0-9]' || true)
PARCHE_SEG=$(apt list --upgradable 2>/dev/null | grep -ci 'security' || true)
if [ "${PARCHE_SEG:-0}" -gt 0 ]; then
    ojo "$PARCHE_SEG parches de seguridad pendientes (de ${PARCHE_TOT:-0} en total)"
elif [ "${PARCHE_TOT:-0}" -gt 0 ]; then
    ojo "${PARCHE_TOT} parches pendientes, ninguno de seguridad"
else
    ok "sin parches pendientes"
fi

[ -f /var/run/reboot-required ] && ojo "hay un reinicio pendiente"

# --- recursos ---------------------------------------------------------------
titulo "Recursos"
USO_DISCO=$(df --output=pcent / | tail -1 | tr -dc '0-9')
dato "disco: ${USO_DISCO}% usado · $(df -h / | tail -1 | awk '{print $4}') libres"
if [ "$USO_DISCO" -ge 80 ]; then
    ojo "el disco pasa del 80%"
elif [ "$USO_DISCO" -ge 60 ]; then
    dato "el disco va por encima de la mitad"
fi

dato "memoria: $(free -h | awk '/^Mem:/{print $3" de "$2" en uso"}')"
LIBRE_MB=$(free -m | awk '/^Mem:/{print $7}')
SWAP_MB=$(free -m | awk '/^Swap:/{print $3}')
if [ "${LIBRE_MB:-0}" -lt 120 ]; then
    ojo "queda menos de 120 MB de memoria disponible (swap en uso: ${SWAP_MB:-0} MB)"
elif [ "${SWAP_MB:-0}" -gt 400 ]; then
    ojo "swap en uso: ${SWAP_MB} MB — los dos sistemas están apretados"
else
    ok "memoria con margen · ${LIBRE_MB} MB disponibles"
fi

# --- contenedores -----------------------------------------------------------
titulo "Contenedores"
for c in "$APP" "$DB" "$CADDY"; do
    ESTADO=$(sudo -n docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo "no existe")
    IMAGEN=$(sudo -n docker inspect -f '{{.Config.Image}}' "$c" 2>/dev/null || echo "-")
    LIMITE=$(sudo -n docker inspect -f '{{.HostConfig.Memory}}' "$c" 2>/dev/null || echo 0)
    LIMITE_MB=$(( ${LIMITE:-0} / 1024 / 1024 ))
    if [ "$ESTADO" = "running" ]; then
        ok "$c · $IMAGEN · límite ${LIMITE_MB} MB"
    else
        ojo "$c · $ESTADO"
    fi
done

# Consumo real contra el límite: es lo que avisa antes de que ahogue
titulo "Consumo"
sudo -n docker stats --no-stream --format '  · {{.Name}}  CPU {{.CPUPerc}}  RAM {{.MemUsage}}' 2>/dev/null

# --- la aplicación ----------------------------------------------------------
titulo "Aplicación"
VERSION=$(sudo -n docker exec "$APP" wget -qO- http://127.0.0.1:8080/api/version 2>/dev/null)
[ -n "$VERSION" ] && ok "responde: $VERSION" || ojo "no responde dentro del contenedor"

SITIO=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$DOMINIO/")
[ "$SITIO" = "200" ] && ok "el sitio responde por HTTPS" || ojo "el sitio devuelve $SITIO por HTTPS"

CIERRE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$DOMINIO/actuator/health")
[ "$CIERRE" = "404" ] && ok "actuator cerrado desde fuera" || ojo "actuator devuelve $CIERRE: debería ser 404"

ERRORES=$(sudo -n docker logs --since 24h "$APP" 2>&1 | grep -c 'ERROR' || true)
[ "${ERRORES:-0}" -gt 0 ] && ojo "$ERRORES líneas con ERROR en las últimas 24 h" \
                          || ok "sin errores en las últimas 24 h"

# --- base de datos ----------------------------------------------------------
titulo "Base de datos"
CAPTURAS=$(sudo -n docker exec "$DB" psql -U User_app -d SIRVE -tAc \
    "select count(*) from sirve.captura" 2>/dev/null)
ACTAS=$(sudo -n docker exec "$DB" psql -U User_app -d SIRVE -tAc \
    "select count(*) from sirve.acta_foto" 2>/dev/null)
TAMANO=$(sudo -n docker exec "$DB" psql -U User_app -d SIRVE -tAc \
    "select pg_size_pretty(pg_database_size('SIRVE'))" 2>/dev/null)
CONEX=$(sudo -n docker exec "$DB" psql -U User_app -d SIRVE -tAc \
    "select count(*) from pg_stat_activity where datname='SIRVE'" 2>/dev/null)
dato "capturas: ${CAPTURAS:-?} · actas registradas: ${ACTAS:-?} · tamaño: ${TAMANO:-?}"
dato "conexiones abiertas: ${CONEX:-?}"

# --- archivos ---------------------------------------------------------------
titulo "Archivos"
if [ -d "$VOL_ACTAS" ]; then
    EN_DISCO=$(sudo -n find "$VOL_ACTAS" -type f 2>/dev/null | wc -l)
    PESO=$(sudo -n du -sh "$VOL_ACTAS" 2>/dev/null | cut -f1)
    dato "actas en el volumen: $EN_DISCO archivos · $PESO"
    if [ -n "${ACTAS:-}" ] && [ "$EN_DISCO" -ne "$ACTAS" ]; then
        ojo "la base dice $ACTAS y el disco tiene $EN_DISCO: hay fotos faltantes"
    fi
else
    ojo "no existe el volumen de actas"
fi

if [ -d "$PLANOS" ]; then
    SVGS=$(find "$PLANOS" -name '*.svg' 2>/dev/null | wc -l)
    PLANOS_PESO=$(du -sh "$PLANOS" 2>/dev/null | cut -f1)
    [ "$SVGS" -ge 3000 ] && ok "planos: $SVGS archivos · $PLANOS_PESO" \
                         || ojo "planos: solo $SVGS archivos · se esperan 3 114"
fi

# --- respaldos --------------------------------------------------------------
titulo "Respaldos"
if sudo -n systemctl is-enabled --quiet sirve-respaldo.timer 2>/dev/null; then
    ok "temporizador activo · $(sudo -n systemctl list-timers sirve-respaldo.timer --no-pager 2>/dev/null | sed -n 2p | awk '{print "próxima: "$1" "$2" "$3}')"
else
    ojo "el temporizador del respaldo no está activo"
fi

ULTIMO=$(sudo -n journalctl -u sirve-respaldo --no-pager -n 200 2>/dev/null | grep -c 'respaldo completo' || true)
[ "${ULTIMO:-0}" -gt 0 ] && ok "la última corrida terminó bien" \
                          || ojo "no encuentro una corrida completa en el registro"

if [ -x "$OCI" ]; then
    ESTADO=$(timeout 30 "$OCI" os object get --auth instance_principal --region mx-queretaro-1 \
              --bucket-name sirve-sih-respaldos --name "sirve/estado/respaldo.json" \
              --file /dev/stdout 2>/dev/null | tail -1)
    if [ -n "$ESTADO" ]; then
        dato "según el bucket: $ESTADO"
        echo "$ESTADO" | grep -q '"ok":true' || ojo "el último respaldo registró fallos"
    else
        ojo "no se pudo leer el estado en el bucket — ¿sigue la regla del grupo dinámico?"
    fi
else
    ojo "falta el CLI de Oracle en $OCI: sin copia externa"
fi

# --- puertos ----------------------------------------------------------------
titulo "Puertos a la escucha"
for p in 22 80 443; do
    ss -tln 2>/dev/null | grep -q ":$p " && dato "$p abierto"
done
if ss -tln 2>/dev/null | grep -qE ':(5432|5433|8080|8088) '; then
    ojo "hay un puerto de servicio publicado: la base y la aplicación no deben verse desde fuera"
else
    ok "solo el proxy escucha desde fuera"
fi

# ¿El Caddy está en la red compartida? Sin eso, SIRVE responde 502
if sudo -n docker inspect "$CADDY" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null | grep -q proxy; then
    ok "el proxy está en la red compartida"
else
    ojo "el proxy NO está en la red proxy: SIRVE va a dar 502"
fi

printf '\n'
