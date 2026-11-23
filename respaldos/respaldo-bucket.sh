#!/bin/bash
# ============================================================================
# SIRVE-P · Respaldo directo al bucket
#
# Lo que hace cada noche, sin dejar copia en el servidor:
#
#   1. vuelca la base de SIRVE y la sube al bucket         (desde memoria)
#   2. vuelca la base del SIH y la sube                    (desde memoria)
#   3. sube las actas que falten                           (incremental)
#   4. borra del bucket los volcados de más de 30 días
#   5. deja un estado legible en sirve/estado/
#
# Los volcados se escriben en /dev/shm, que es memoria, no disco: el archivo
# existe solo mientras dura la subida y desaparece al terminar. Si algo falla,
# se borra igual.
#
# La identidad la pone la instancia (instance_principal): no hay llaves en
# disco. El grupo dinámico sirve-respaldos-dg es quien autoriza.
# ============================================================================

set -uo pipefail

OCI=/home/ubuntu/oci-venv/bin/oci
REGION=mx-queretaro-1
BUCKET=sirve-sih-respaldos
RETENCION_DIAS=30
TRABAJO=/dev/shm

SIRVE_DIR=/opt/sirve-p
SIH_DIR=/opt/sih
ACTAS=/var/lib/docker/volumes/sirve-p_actas/_data

FECHA=$(date -u +%Y-%m-%d_%H%M)
LOG() { logger -t respaldo-sirve -- "$*"; echo "$(date -u +%H:%M:%S) $*"; }

FALLOS=0
SUBIDO=""

# --- 1 y 2: las dos bases ---------------------------------------------------
respaldar_base() {
  local etiqueta=$1 contenedor=$2 usuario=$3 base=$4 destino=$5
  local archivo="$TRABAJO/respaldo-$etiqueta.dump"

  LOG "volcando $etiqueta…"
  if ! sudo -n docker exec "$contenedor" pg_dump -U "$usuario" -Fc -d "$base" > "$archivo" 2> "$TRABAJO/error-$etiqueta.txt"; then
    LOG "ERROR: no se pudo volcar $etiqueta: $(tail -1 "$TRABAJO/error-$etiqueta.txt" 2>/dev/null)"
    rm -f "$archivo" "$TRABAJO/error-$etiqueta.txt"
    FALLOS=$((FALLOS + 1))
    return 1
  fi

  local tamano
  tamano=$(stat -c %s "$archivo")
  LOG "  $etiqueta: $((tamano / 1024)) KB; subiendo…"

  local remoto="$destino/$etiqueta-$FECHA.dump"
  if timeout 300 "$OCI" os object put --auth instance_principal --region "$REGION" \
        --bucket-name "$BUCKET" --file "$archivo" --force \
        --name "$remoto" > /dev/null 2>&1; then
    LOG "  subido a $remoto"
    SUBIDO="$SUBIDO $etiqueta"
  else
    LOG "ERROR: el volcado de $etiqueta no se pudo subir"
    FALLOS=$((FALLOS + 1))
  fi

  # Pase lo que pase, el archivo no se queda: ni en disco ni en memoria.
  rm -f "$archivo" "$TRABAJO/error-$etiqueta.txt"
}

SIRVE_USUARIO=$(grep -E '^DB_ADMIN_USER=' "$SIRVE_DIR/.env" | cut -d= -f2-)
SIRVE_BASE=$(grep -E '^DB_NAME=' "$SIRVE_DIR/.env" | cut -d= -f2-)
respaldar_base sirve sirve-p-db-1 "$SIRVE_USUARIO" "$SIRVE_BASE" "sirve/base"

if [ -f "$SIH_DIR/.env" ]; then
  SIH_USUARIO=$(grep -E '^DB_USER=' "$SIH_DIR/.env" | cut -d= -f2-)
  SIH_BASE=$(grep -E '^DB_NAME=' "$SIH_DIR/.env" | cut -d= -f2-)
  [ -n "$SIH_USUARIO" ] && respaldar_base sih sih-ia-db-1 "$SIH_USUARIO" "$SIH_BASE" "sih/base"
fi

# --- 3: actas, solo las que faltan -----------------------------------------
# --no-overwrite hace que el CLI salte lo que ya está: la primera vez sube
# todo y las siguientes solo lo del día.
if [ -d "$ACTAS" ]; then
  LOG "subiendo actas nuevas…"
  SALIDA=$(timeout 1800 "$OCI" os object bulk-upload --auth instance_principal --region "$REGION" \
            --bucket-name "$BUCKET" --src-dir "$ACTAS" --prefix "sirve/actas/" \
            --no-overwrite 2>&1) || true
  SUBIDAS=$(printf '%s\n' "$SALIDA" | grep -c '^Uploaded ' || true)
  LOG "  actas subidas: ${SUBIDAS:-0}"
else
  LOG "AVISO: no existe la carpeta de actas"
fi

# --- 4: limpiar volcados viejos del bucket ---------------------------------
LIMITE=$(date -u -d "$RETENCION_DIAS days ago" +%Y-%m-%dT%H:%M:%SZ)
LOG "borrando volcados anteriores a $LIMITE…"
BORRADOS=0
for prefijo in "sirve/base/" "sih/base/"; do
  while read -r nombre; do
    [ -z "$nombre" ] && continue
    if timeout 120 "$OCI" os object delete --auth instance_principal --region "$REGION" \
          --bucket-name "$BUCKET" --object-name "$nombre" --force > /dev/null 2>&1; then
      BORRADOS=$((BORRADOS + 1))
    fi
  done < <(timeout 180 "$OCI" os object list --auth instance_principal --region "$REGION" \
            --bucket-name "$BUCKET" --prefix "$prefijo" --all \
            --query "data[?\"time-created\"<='$LIMITE'].name" --raw-output 2>/dev/null | tr -d '",[]' | tr ' ' '\n')
done
LOG "  volcados borrados: $BORRADOS"

# --- 5: dejar constancia ---------------------------------------------------
ESTADO=$(printf '{"fecha":"%s","fallos":%d,"ok":%s}' \
          "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$FALLOS" \
          "$([ "$FALLOS" -eq 0 ] && echo true || echo false)")
echo "$ESTADO" > "$TRABAJO/estado.json"
timeout 60 "$OCI" os object put --auth instance_principal --region "$REGION" \
  --bucket-name "$BUCKET" --file "$TRABAJO/estado.json" --force \
  --name "sirve/estado/respaldo.json" > /dev/null 2>&1 || true
rm -f "$TRABAJO/estado.json"

if [ "$FALLOS" -eq 0 ]; then
  LOG "respaldo completo"
  exit 0
else
  LOG "respaldo con $FALLOS fallo(s)"
  exit 1
fi
