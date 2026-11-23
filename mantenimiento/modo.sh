#!/bin/bash
# ============================================================================
# SIRVE-P · Modo de operación
#
# El servidor tiene 952 MB de memoria y no alcanza para los dos sistemas a la
# vez. Como no coinciden —el SIH se usa en periodos escolares, SIRVE el día de
# la jornada—, se turnan.
#
# El proxy (Caddy) NO se detiene nunca: es el que da el certificado y reparte
# los dos dominios. Solo se detienen la aplicación y la base que no se está
# usando.
#
#   modo.sh sirve     detiene el SIH (aplicación y base) y levanta SIRVE
#   modo.sh sih       detiene SIRVE y levanta el SIH
#   modo.sh estado    qué está corriendo y cuánta memoria queda
# ============================================================================

set -u

SIRVE=/opt/sirve-p
SIH=/opt/sih

memoria() {
  free -m | awk 'NR==2 {printf "memoria: %s MB de %s MB usados · %s MB disponibles", $3, $2, $7}'
  free -m | awk 'NR==3 {printf " · swap: %s MB usados de %s MB\n", $3, $2}'
}

estado() {
  echo "=== contenedores ==="
  sudo -n docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null
  echo ""
  memoria
  echo ""
  echo "=== consumo por contenedor ==="
  sudo -n docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' 2>/dev/null
}

case "${1:-}" in
  sirve)
    echo "== Deteniendo el SIH (la aplicación y su base; el proxy sigue) =="
    (cd "$SIH" && sudo -n docker compose stop app db) || true

    echo "== Levantando SIRVE =="
    (cd "$SIRVE" && sudo -n docker compose up -d) || { echo "Falló el arranque de SIRVE"; exit 1; }

    echo "== Esperando a que responda =="
    for i in $(seq 1 40); do
      if sudo -n docker exec sirve-p-app-1 wget -qO- http://127.0.0.1:8080/api/version 2>/dev/null; then
        echo ""
        echo "SIRVE listo."
        memoria
        exit 0
      fi
      sleep 3
    done
    echo "SIRVE no respondió; revisa: docker compose -f $SIRVE/docker-compose.yml logs app"
    exit 1
    ;;

  sih)
    echo "== Deteniendo SIRVE =="
    (cd "$SIRVE" && sudo -n docker compose stop) || true

    echo "== Levantando el SIH =="
    (cd "$SIH" && sudo -n docker compose up -d) || { echo "Falló el arranque del SIH"; exit 1; }

    echo "== Esperando a que responda =="
    for i in $(seq 1 40); do
      if curl -fsS -o /dev/null http://127.0.0.1/api/version 2>/dev/null; then
        echo "SIH listo."
        memoria
        exit 0
      fi
      sleep 3
    done
    echo "Aviso: el SIH no respondió en 2 minutos; revisa sus registros."
    exit 1
    ;;

  estado|"")
    estado
    ;;

  *)
    echo "Uso: $0 {sirve|sih|estado}"
    exit 1
    ;;
esac
