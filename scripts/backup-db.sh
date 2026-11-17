#!/bin/bash
# scripts/backup-db.sh — Sauvegarde PostgreSQL de l'instance TCI SaaS
# Usage : ./scripts/backup-db.sh
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

if [[ -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

PROJECT_NAME="${PROJECT_NAME:-tci}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups-${PROJECT_NAME}}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

APP_CONTAINER="${PROJECT_NAME}-app-db"
if docker inspect "$APP_CONTAINER" >/dev/null 2>&1; then
  echo "Sauvegarde de $APP_CONTAINER..."
  docker exec "$APP_CONTAINER" sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
    | gzip -9 > "$BACKUP_DIR/app-db-${TIMESTAMP}.sql.gz"
  gzip -t "$BACKUP_DIR/app-db-${TIMESTAMP}.sql.gz"
  echo "OK : $BACKUP_DIR/app-db-${TIMESTAMP}.sql.gz"
fi

KC_CONTAINER="${PROJECT_NAME}-keycloak-db"
if docker inspect "$KC_CONTAINER" >/dev/null 2>&1; then
  echo "Sauvegarde de $KC_CONTAINER..."
  docker exec "$KC_CONTAINER" sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
    | gzip -9 > "$BACKUP_DIR/keycloak-db-${TIMESTAMP}.sql.gz"
  gzip -t "$BACKUP_DIR/keycloak-db-${TIMESTAMP}.sql.gz"
  echo "OK : $BACKUP_DIR/keycloak-db-${TIMESTAMP}.sql.gz"
fi

find "$BACKUP_DIR" -name "*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
