#!/usr/bin/env bash
# =====================================================================
# SIRVE-P · Agregar foto de muestra a casillas capturadas que no tienen
# ---------------------------------------------------------------------
# Copia una misma imagen a cada casilla capturada que no tenga acta, y
# registra la fila en la base con la ruta y el tamaño real del archivo.
#
# Sirve para medir cuánto ocupa el acervo de actas en disco. No es una
# prueba funcional: todas las fotos son la misma.
#
# Uso:
#   sudo bash prueba-actas.sh [limite] [id_eleccion]
#
#   sudo bash prueba-actas.sh 5      # prueba chica, para verificar
#   sudo bash prueba-actas.sh 1000 9 # las 1 000 de Gobernatura 2027
# =====================================================================
set -euo pipefail

LIMITE="${1:-5}"
ELECCION="${2:-9}"

VOLUMEN=/var/lib/docker/volumes/sirve-p_actas/_data
MUESTRA="$VOLUMEN/muestra-acta.jpg"
CONTENEDOR=sirve-p-db-1
BASE=SIRVE
USUARIO=User_app

if [ ! -f "$MUESTRA" ]; then
  echo "Falta la imagen de muestra en $MUESTRA"
  echo "Cópiala ahí con: cp acta-muestra.jpg $MUESTRA"
  exit 1
fi

BYTES=$(stat -c %s "$MUESTRA")
echo "muestra: $MUESTRA ($BYTES bytes, $(awk "BEGIN{printf \"%.2f\", $BYTES/1048576}") MB)"

echo ""
echo "=== disco antes ==="
df -h / | tail -1
du -sh "$VOLUMEN"

# Lista de casillas a llenar: capturadas y sin acta.
LISTA=$(mktemp)
sudo -n docker exec "$CONTENEDOR" psql -U "$USUARIO" -d "$BASE" -tA -F'|' -c "
    SELECT c.id_casilla,
           c.id_eleccion,
           p.anio || '/' ||
           p.anio || '-' || upper(e.clave) || '-' ||
           lpad(m.clave, 3, '0') || '-' || s.clave || '-' || k.tipo || '.jpg'
      FROM sirve.captura c
      JOIN sirve.casilla   k ON k.id = c.id_casilla
      JOIN sirve.seccion   s ON s.id = k.id_seccion
      JOIN sirve.municipio m ON m.id = s.id_municipio
      JOIN sirve.eleccion  e ON e.id = c.id_eleccion
      JOIN sirve.proceso_electoral p ON p.id = e.id_proceso
     WHERE c.id_eleccion = $ELECCION
       AND c.estado = 'VIGENTE'
       AND NOT EXISTS (SELECT 1 FROM sirve.acta_foto f
                        WHERE f.id_casilla = c.id_casilla
                          AND f.id_eleccion = c.id_eleccion)
     ORDER BY c.id_casilla
     LIMIT $LIMITE" > "$LISTA"

TOTAL=$(wc -l < "$LISTA")
echo "casillas a llenar: $TOTAL"
if [ "$TOTAL" -eq 0 ]; then
  echo "Nada que hacer."
  rm -f "$LISTA"
  exit 0
fi

# 1) Copiar los archivos. Primero los archivos, después las filas: si algo
#    falla, es mejor una foto sin registrar que una fila apuntando a la nada.
echo "copiando archivos…"
while IFS='|' read -r id_casilla id_eleccion ruta; do
  [ -z "$ruta" ] && continue
  destino="$VOLUMEN/$ruta"
  mkdir -p "$(dirname "$destino")"
  # --reflink=never a propósito: en XFS, cp comparte las extensiones del
  # archivo original y mil copias de la misma imagen ocupan casi nada. Para
  # medir disco hace falta que cada archivo ocupe lo suyo.
  cp --reflink=never "$MUESTRA" "$destino"
done < "$LISTA"

# El dueño lo marca el servicio actas-permisos; aquí se respeta el del volumen.
chown -R 100:101 "$VOLUMEN" 2>/dev/null || true

# 2) Registrar las filas. Se arman los VALUES con la MISMA lista que se copió:
#    si se dejara un SELECT aparte, el límite se aplicaría solo a las copias y
#    quedarían filas apuntando a archivos que no existen.
echo "registrando filas…"
{
  echo "INSERT INTO sirve.acta_foto (id_casilla, id_eleccion, ruta, bytes) VALUES"
  primero=1
  while IFS='|' read -r id_casilla id_eleccion ruta; do
    [ -z "$ruta" ] && continue
    [ "$primero" -eq 0 ] && echo ","
    primero=0
    printf "  (%s, %s, '%s', %s)" "$id_casilla" "$id_eleccion" "$ruta" "$BYTES"
  done < "$LISTA"
  echo ""
  echo "ON CONFLICT (id_casilla, id_eleccion) DO NOTHING;"
} | sudo -n docker exec -i "$CONTENEDOR" psql -U "$USUARIO" -d "$BASE" -v ON_ERROR_STOP=1
rm -f "$LISTA"

echo ""
echo "=== disco después ==="
df -h / | tail -1
du -sh "$VOLUMEN"

echo ""
echo "=== actas registradas en la elección $ELECCION ==="
sudo -n docker exec "$CONTENEDOR" psql -U "$USUARIO" -d "$BASE" -c "
  SELECT count(*) AS actas, pg_size_pretty(sum(bytes)::bigint) AS peso_total
    FROM sirve.acta_foto WHERE id_eleccion = $ELECCION;"
