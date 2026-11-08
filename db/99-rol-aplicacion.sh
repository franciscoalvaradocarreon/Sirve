#!/bin/sh
# ============================================================================
# Rol de la aplicación.
#
# Este script corre al final de la inicialización (99 va después de los SQL),
# así que las tablas ya existen y los permisos se aplican a todas.
#
# El rol de la app NO es el de administración: lee y escribe datos, no puede
# alterar el esquema. Es el equivalente de sih_app en el SIH.
#
# La clave viene de DB_PASSWORD_APP, que el compose toma del .env.
# ============================================================================
set -e

: "${DB_APP_USER:=sirve_app}"
: "${DB_PASSWORD_APP:?falta DB_PASSWORD_APP}"

echo "SIRVE-P: creando permisos para el rol ${DB_APP_USER}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_APP_USER}') THEN
            CREATE ROLE ${DB_APP_USER} LOGIN;
        END IF;
    END
    \$\$;

    ALTER ROLE ${DB_APP_USER} WITH LOGIN PASSWORD '${DB_PASSWORD_APP}';

    GRANT USAGE ON SCHEMA sirve TO ${DB_APP_USER};
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sirve TO ${DB_APP_USER};
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sirve TO ${DB_APP_USER};

    ALTER DEFAULT PRIVILEGES IN SCHEMA sirve
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${DB_APP_USER};
    ALTER DEFAULT PRIVILEGES IN SCHEMA sirve
        GRANT USAGE, SELECT ON SEQUENCES TO ${DB_APP_USER};
EOSQL

echo "SIRVE-P: permisos del rol ${DB_APP_USER} listos"
