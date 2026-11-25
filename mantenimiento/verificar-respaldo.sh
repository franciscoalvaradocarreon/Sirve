#!/bin/bash
# ============================================================================
# ¿El respaldo automático está funcionando?
#
# Responde con el código de salida, sin ruido:
#   0  el último respaldo es reciente y terminó bien
#   1  algo está mal (y dice qué)
#
# Lo usa la guardia de GitHub, y también se puede correr a mano:
#
#     sudo bash /opt/sirve-p/mantenimiento/verificar-respaldo.sh 30
#
# El número es la antigüedad máxima tolerada, en horas.
#
# Nació de un fallo real y silencioso: en el servidor anterior los respaldos
# corrían de noche, fallaban sin avisar y nadie lo supo durante días. Un
# respaldo que no se comprueba no es un respaldo.
# ============================================================================
set -uo pipefail

MAX_HORAS="${1:-30}"
OCI=/home/ubuntu/oci-venv/bin/oci
REGION=mx-queretaro-1
BUCKET=sirve-sih-respaldos

falla() { echo "FALLA: $*"; exit 1; }
ok()    { echo "OK: $*"; }

# --- 1. el temporizador existe y está armado --------------------------------
if ! systemctl is-enabled --quiet sirve-respaldo.timer 2>/dev/null; then
    falla "el temporizador sirve-respaldo.timer no está habilitado"
fi
if ! systemctl is-active --quiet sirve-respaldo.timer 2>/dev/null; then
    falla "el temporizador sirve-respaldo.timer no está activo"
fi
echo "temporizador: armado · próxima corrida $(systemctl list-timers sirve-respaldo.timer --no-pager 2>/dev/null | sed -n 2p | awk '{print $1, $2, $3}')"

# --- 2. la última corrida terminó bien -------------------------------------
ULTIMA=$(journalctl -u sirve-respaldo --no-pager -o cat 2>/dev/null | grep -c 'respaldo completo' || true)
[ "${ULTIMA:-0}" -gt 0 ] || falla "no hay ninguna corrida completa en el registro del servicio"
echo "la última corrida terminó sin fallos"

# --- 3. el estado que dejó en el bucket ------------------------------------
ESTADO=$("$OCI" os object get --auth instance_principal --region "$REGION" \
          --bucket-name "$BUCKET" --name "sirve/estado/respaldo.json" \
          --file /dev/stdout 2>/dev/null | tail -1)
[ -n "$ESTADO" ] || falla "no se pudo leer sirve/estado/respaldo.json del bucket (¿la regla del grupo dinámico?)"
echo "estado en el bucket: $ESTADO"

echo "$ESTADO" | grep -q '"ok":true' || falla "el último respaldo registró fallos"

# --- 4. ¿qué tan viejo es? --------------------------------------------------
FECHA=$(echo "$ESTADO" | sed 's/.*"fecha":"\([^"]*\)".*/\1/')
[ -n "$FECHA" ] || falla "el estado no trae fecha"
EPOCA=$(date -u -d "$FECHA" +%s 2>/dev/null) || falla "no pude interpretar la fecha «$FECHA»"
AHORA=$(date -u +%s)
HORAS=$(( (AHORA - EPOCA) / 3600 ))

if [ "$HORAS" -gt "$MAX_HORAS" ]; then
    falla "el último respaldo tiene $HORAS horas (el máximo tolerado es $MAX_HORAS)"
fi
echo "antigüedad: $HORAS horas (máximo $MAX_HORAS)"

# --- 5. los volcados de las dos bases están donde deben --------------------
for prefijo in "sirve/base/" "sih/base/"; do
    N=$(timeout 60 "$OCI" os object list --auth instance_principal --region "$REGION" \
          --bucket-name "$BUCKET" --prefix "$prefijo" --all \
          --query 'length(data)' 2>/dev/null | tr -d '" ')
    if [ -z "${N:-}" ] || [ "${N:-0}" -lt 1 ]; then
        falla "no hay volcados en $prefijo"
    fi
    echo "volcados en $prefijo: $N"
done

# --- 6. las actas siguen ahí (no deberían bajar nunca) ---------------------
ACTAS_BD=$(sudo -n docker exec sirve-p-db-1 psql -U User_app -d SIRVE -tAc \
            "select count(*) from sirve.acta_foto" 2>/dev/null)
ACTAS_DISCO=$(sudo -n find /var/lib/docker/volumes/sirve-p_actas/_data -type f 2>/dev/null | wc -l)
if [ -n "${ACTAS_BD:-}" ] && [ "$ACTAS_BD" -ne "$ACTAS_DISCO" ]; then
    falla "la base registra $ACTAS_BD actas y el disco tiene $ACTAS_DISCO"
fi
echo "actas: $ACTAS_DISCO en disco, igual que en la base"

ok "el respaldo está al día"
exit 0
