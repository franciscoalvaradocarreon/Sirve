#!/bin/bash
# ============================================================================
# Prueba de restauración
#
# Baja el último volcado del bucket, lo restaura en una base aparte y compara
# contra producción: conteos y sumas. Si no cuadra, el respaldo no sirve y hay
# que saberlo hoy, no el día que haga falta.
#
# No toca la base de producción. Al terminar, borra la base de prueba.
# ============================================================================
set -uo pipefail

DB=sirve-p-db-1
USUARIO=User_app
OCI=/home/ubuntu/oci-venv/bin/oci
REGION=mx-queretaro-1
BUCKET=sirve-sih-respaldos
PRUEBA=prueba_restore
TRABAJO=/dev/shm

log() { printf '%s\n' "$*"; }
psql_prod() { sudo -n docker exec "$DB" psql -U "$USUARIO" -d SIRVE -tAc "$1" 2>/dev/null; }
psql_prueba() { sudo -n docker exec "$DB" psql -U "$USUARIO" -d "$PRUEBA" -tAc "$1" 2>/dev/null; }

log "=== 1. el volcado más reciente del bucket ==="
ULTIMO=$(timeout 60 "$OCI" os object list --auth instance_principal --region "$REGION" \
          --bucket-name "$BUCKET" --prefix "sirve/base/" --all \
          --query 'sort_by(data, &"time-created")[-1].name' --raw-output 2>/dev/null | tr -d '"')
if [ -z "$ULTIMO" ] || [ "$ULTIMO" = "null" ]; then
  log "ERROR: no se pudo listar el bucket"; exit 1
fi
log "  $ULTIMO"

INICIO=$(date +%s)
log ""
log "=== 2. bajarlo a memoria ==="
rm -f "$TRABAJO/prueba.dump"
if ! timeout 300 "$OCI" os object get --auth instance_principal --region "$REGION" \
      --bucket-name "$BUCKET" --name "$ULTIMO" --file "$TRABAJO/prueba.dump" > /dev/null 2>&1; then
  log "ERROR: no se pudo descargar"; exit 1
fi
log "  $(stat -c %s "$TRABAJO/prueba.dump") bytes en $TRABAJO"

log ""
log "=== 3. base de prueba limpia ==="
sudo -n docker exec "$DB" psql -U "$USUARIO" -d postgres -c "DROP DATABASE IF EXISTS $PRUEBA;" > /dev/null 2>&1
sudo -n docker exec "$DB" psql -U "$USUARIO" -d postgres -c "CREATE DATABASE $PRUEBA;" > /dev/null 2>&1
log "  creada $PRUEBA"

log ""
log "=== 4. restaurar ==="
sudo -n docker cp "$TRABAJO/prueba.dump" "$DB:/tmp/prueba.dump" > /dev/null 2>&1
SALIDA=$(sudo -n docker exec "$DB" pg_restore -U "$USUARIO" -d "$PRUEBA" \
          --no-owner --no-privileges -j 2 /tmp/prueba.dump 2>&1)
ERRORES=$(printf '%s\n' "$SALIDA" | grep -c 'error:' || true)
AVISOS=$(printf '%s\n' "$SALIDA" | grep -c 'warning:' || true)
log "  errores: ${ERRORES:-0} · avisos: ${AVISOS:-0}"
if [ "${ERRORES:-0}" -gt 0 ]; then
  log "  primeros errores:"
  printf '%s\n' "$SALIDA" | grep 'error:' | head -5 | sed 's/^/    /'
fi

log ""
log "=== 5. comparar contra producción ==="
printf '  %-24s %12s %12s  %s\n' "tabla" "producción" "restaurada" "resultado"
FALLOS=0
comparar() {
  local etiqueta=$1 consulta=$2
  local a b
  a=$(psql_prod "$consulta")
  b=$(psql_prueba "$consulta")
  if [ -n "$a" ] && [ "$a" = "$b" ]; then
    printf '  %-24s %12s %12s  ✓\n' "$etiqueta" "$a" "$b"
  else
    printf '  %-24s %12s %12s  ✗\n' "$etiqueta" "${a:-?}" "${b:-?}"
    FALLOS=$((FALLOS + 1))
  fi
}

comparar "municipios"        "select count(*) from sirve.municipio"
comparar "secciones"         "select count(*) from sirve.seccion"
comparar "casillas"          "select count(*) from sirve.casilla"
comparar "capturistas"       "select count(*) from sirve.capturista"
comparar "capturas"          "select count(*) from sirve.captura"
comparar "actas (filas)"     "select count(*) from sirve.acta_foto"
comparar "partidos"          "select count(*) from sirve.partido"
comparar "opciones boleta"   "select count(*) from sirve.opcion_boleta"
comparar "usuarios"          "select count(*) from sirve.usuario"
comparar "suma de votos"     "select coalesce(sum(votos_validos),0) from sirve.captura"
comparar "suma acta total"   "select coalesce(sum(total_acta),0) from sirve.captura"
comparar "renglones de voto" "select count(*) from sirve.captura_voto"
comparar "suma de opciones"  "select coalesce(sum(votos),0) from sirve.captura_voto"
comparar "huella de capturas" "select md5(string_agg(id||':'||total_acta||':'||votos_validos||':'||nulos, '|' order by id)) from sirve.captura"
comparar "huella de actas"    "select md5(string_agg(ruta||':'||bytes, '|' order by ruta)) from sirve.acta_foto"
comparar "huella de casillas" "select md5(string_agg(id||':'||clave||':'||tipo, '|' order by id)) from sirve.casilla"
comparar "tablas del esquema" "select count(*) from information_schema.tables where table_schema='sirve' and table_type='BASE TABLE'"
comparar "vistas"            "select count(*) from information_schema.views where table_schema='sirve'"
comparar "funciones"         "select count(*) from information_schema.routines where routine_schema='sirve'"

log ""
log "=== 6. una consulta de las de verdad ==="
PRIMERA_PROD=$(psql_prod "select clave from sirve.seccion order by clave limit 1")
PRIMERA_PRUEBA=$(psql_prueba "select clave from sirve.seccion order by clave limit 1")
log "  primera sección: producción=$PRIMERA_PROD · restaurada=$PRIMERA_PRUEBA"

# Una lectura como la que hace el reporte de avance: cuántas capturas hay por
# estado, que cruza la tabla de capturas con su catálogo.
CONSULTA="select estado||': '||count(*) from sirve.captura group by estado order by estado"
log "  producción:  $(psql_prod "$CONSULTA" | tr '\n' ' ')"
log "  restaurada:  $(psql_prueba "$CONSULTA" | tr '\n' ' ')"
if [ "$(psql_prod "$CONSULTA")" = "$(psql_prueba "$CONSULTA")" ]; then
  log "  ✓ coinciden"
else
  log "  ✗ no coinciden"
  FALLOS=$((FALLOS + 1))
fi

log ""
log "=== 7. limpiar ==="
sudo -n docker exec "$DB" psql -U "$USUARIO" -d postgres -c "DROP DATABASE IF EXISTS $PRUEBA;" > /dev/null 2>&1 \
  && log "  base de prueba borrada"
sudo -n docker exec "$DB" rm -f /tmp/prueba.dump
rm -f "$TRABAJO/prueba.dump"
log "  volcado temporal borrado"

FIN=$(date +%s)
log ""
if [ "$FALLOS" -eq 0 ]; then
  log "RESULTADO: el respaldo restaura completo · $(($FIN - $INICIO)) s"
  exit 0
else
  log "RESULTADO: $FALLOS diferencias — el respaldo NO coincide con producción"
  exit 1
fi
