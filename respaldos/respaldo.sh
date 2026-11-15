#!/usr/bin/env bash
# ============================================================================
# SIRVE-P · Respaldo diario de la base
#
# Genera un volcado comprimido de la base SIRVE, comprueba que el archivo sea
# legible y borra los que tengan más días que la retención.
#
# Se ejecuta con cron, como root, porque habla con Docker:
#
#     /etc/cron.d/sirve-respaldo
#     0 3 * * * root /opt/sirve-p/respaldos/respaldo.sh
#
# A mano, para probar:  sudo /opt/sirve-p/respaldos/respaldo.sh
# ============================================================================
set -euo pipefail

CONTENEDOR="sirve-p-db-1"
BASE="SIRVE"
USUARIO="User_app"
DESTINO="${DESTINO:-/opt/respaldos/sirve}"
RETENCION_DIAS="${RETENCION_DIAS:-14}"
MINIMO_BYTES=$((1024 * 1024))   # menos de 1 MB significa que algo salió mal

FECHA="$(date +%Y-%m-%d_%H%M)"
ARCHIVO="$DESTINO/sirve-$FECHA.dump"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

mkdir -p "$DESTINO"

# Un respaldo a la vez: si el anterior se tarda, no se encima.
exec 9>"$DESTINO/.candado"
if ! flock -n 9; then
    log "Ya hay un respaldo en curso; se omite esta ejecución."
    exit 0
fi

if ! docker inspect -f '{{.State.Running}}' "$CONTENEDOR" 2>/dev/null | grep -q true; then
    log "ERROR: el contenedor $CONTENEDOR no está corriendo."
    exit 1
fi

log "Respaldando $BASE en $ARCHIVO"

# Formato «custom»: comprimido y restaurable por tablas.
if ! docker exec "$CONTENEDOR" pg_dump -U "$USUARIO" -Fc "$BASE" > "$ARCHIVO"; then
    log "ERROR: pg_dump falló."
    rm -f "$ARCHIVO"
    exit 1
fi

# --- comprobaciones ---------------------------------------------------------
TAMANO=$(stat -c%s "$ARCHIVO")
if [ "$TAMANO" -lt "$MINIMO_BYTES" ]; then
    log "ERROR: el respaldo pesa $TAMANO bytes, menos de lo mínimo esperado."
    rm -f "$ARCHIVO"
    exit 1
fi

# Todo volcado de PostgreSQL empieza con «PGDMP».
if [ "$(head -c 5 "$ARCHIVO")" != "PGDMP" ]; then
    log "ERROR: el archivo no tiene la firma de un volcado de PostgreSQL."
    rm -f "$ARCHIVO"
    exit 1
fi

# Que pg_restore pueda leer el índice: si está truncado, esto falla.
if ! docker run --rm -i postgres:17-alpine pg_restore --list > /dev/null < "$ARCHIVO"; then
    log "ERROR: pg_restore no pudo leer el respaldo; está dañado."
    rm -f "$ARCHIVO"
    exit 1
fi

log "Respaldo correcto: $(numfmt --to=iec "$TAMANO")"

# --- retención --------------------------------------------------------------
BORRADOS=$(find "$DESTINO" -maxdepth 1 -name 'sirve-*.dump' -type f \
             -mtime "+$RETENCION_DIAS" -print -delete | wc -l)
if [ "$BORRADOS" -gt 0 ]; then
    log "Se borraron $BORRADOS respaldos con más de $RETENCION_DIAS días."
fi

TOTAL=$(find "$DESTINO" -maxdepth 1 -name 'sirve-*.dump' -type f | wc -l)
OCUPA=$(du -sh "$DESTINO" | cut -f1)
log "Respaldos conservados: $TOTAL · ocupan $OCUPA"

# --- copia externa en Oracle Object Storage --------------------------------
# La base y las actas viven en el mismo disco del servidor: si ese disco
# muere, se pierden las dos. Esta copia queda fuera, en un bucket privado.
# La identidad la pone la instancia (instance_principal): no hay llaves
# guardadas en disco.
BUCKET="sirve-sih-respaldos"
REGION="mx-queretaro-1"
OCI="/usr/local/bin/oci"

if [ -x "$OCI" ]; then
    if "$OCI" os object put --auth instance_principal --region "$REGION" \
            --bucket-name "$BUCKET" --file "$ARCHIVO" \
            --name "sirve/base/$(basename "$ARCHIVO")" > /dev/null 2>&1; then
        log "Copia externa subida: sirve/base/$(basename "$ARCHIVO")"
    else
        log "ERROR: no se pudo subir la copia externa. El respaldo local SÍ está."
    fi
else
    log "AVISO: el CLI de Oracle no está instalado; sin copia externa."
fi

# --- actas: solo las nuevas ------------------------------------------------
# --no-overwrite hace que el CLI salte lo que ya está: la primera vez sube
# todo, las siguientes solo las actas del día. Con 700 MB por elección, volver
# a subirlas cada noche sería absurdo.
ACTAS="/var/lib/docker/volumes/sirve-p_actas/_data"

if [ -x "$OCI" ] && [ -d "$ACTAS" ]; then
    # El CLI imprime «Uploaded <archivo>» por cada objeto que sube. Antes se
    # contaba buscando «"status": "uploaded"», que era el formato del JSON de
    # una versión anterior: el contador daba cero aunque la subida funcionara,
    # y eso es peor que no tener contador, porque parece que no pasó nada.
    SALIDA=$(mktemp)
    if "$OCI" os object bulk-upload --auth instance_principal \
            --region "$REGION" --bucket-name "$BUCKET" \
            --src-dir "$ACTAS" --prefix "sirve/actas/" \
            --no-overwrite > "$SALIDA" 2>&1; then
        SUBIDAS=$(grep -c '^Uploaded ' "$SALIDA" || true)
        log "Actas subidas al bucket: ${SUBIDAS:-0}"

        # Los fallos vienen en el JSON final: si la clave no está vacía, algo
        # se quedó fuera y hay que verlo en el registro, no adivinarlo.
        if grep -q '"upload-failures": *{ *}' "$SALIDA"; then
            log "Sin fallos al subir actas."
        else
            log "AVISO: el CLI reportó fallos al subir actas; revisar la salida."
        fi
    else
        log "ERROR: falló la subida de actas; el respaldo local SÍ está."
    fi
    rm -f "$SALIDA"

    # Cuánto ocupa el acervo completo en el bucket: el dato que interesa para
    # saber cuánto falta para el límite.
    TOTAL_ACTAS=$("$OCI" os object list --auth instance_principal --region "$REGION" \
                    --bucket-name "$BUCKET" --prefix "sirve/actas/" --all \
                    --query 'length(data)' 2>/dev/null || echo 0)
    log "Actas en el bucket: ${TOTAL_ACTAS:-0}"
fi
