#!/usr/bin/env bash
# scripts/backup-local.sh
# Sauvegarde locale chiffrée AES-256 (zéro envoi hors du site client)
# des bases PostgreSQL (app-db + keycloak-db) et de la licence /data/license.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_DIR}"

if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

PROJECT_NAME="${PROJECT_NAME:-box}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/tci-box}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
BACKUP_PASSPHRASE="${BACKUP_PASSPHRASE:-}"
DATE="$(date +%Y%m%d_%H%M%S)"

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

APP_DB_CONTAINER="${PROJECT_NAME}-app-db"
KC_DB_CONTAINER="${PROJECT_NAME}-keycloak-db"
BACKEND_CONTAINER="${PROJECT_NAME}-backend"

echo "=== Sauvegarde locale TCI Box (${DATE}) ==="

TMP_TAR="${BACKUP_DIR}/tci-backup-${DATE}.tar.gz"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "${WORK_DIR}"' EXIT

echo "Dump app-db..."
docker exec "${APP_DB_CONTAINER}" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c' > "${WORK_DIR}/app-db.sql"

echo "Dump keycloak-db..."
docker exec "${KC_DB_CONTAINER}" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c' > "${WORK_DIR}/keycloak-db.sql"

echo "Copie état licence..."
docker cp "${BACKEND_CONTAINER}:/data/license" "${WORK_DIR}/license" 2>/dev/null || true

tar -czf "${TMP_TAR}" -C "${WORK_DIR}" .

if [ -n "${BACKUP_PASSPHRASE}" ]; then
  ENC_FILE="${TMP_TAR}.enc"
  printf '%s' "${BACKUP_PASSPHRASE}" | openssl enc -aes-256-cbc -salt -pbkdf2 -pass stdin -in "${TMP_TAR}" -out "${ENC_FILE}"
  rm -f "${TMP_TAR}"
  chmod 600 "${ENC_FILE}"
  echo "Sauvegarde chiffrée créée : ${ENC_FILE}"
  echo "Pour déchiffrer : openssl enc -d -aes-256-cbc -pbkdf2 -in ${ENC_FILE} -out restore.tar.gz"
else
  chmod 600 "${TMP_TAR}"
  echo "Sauvegarde créée (non chiffrée — définissez BACKUP_PASSPHRASE pour chiffrer): ${TMP_TAR}"
fi

find "${BACKUP_DIR}" -type f \( -name "tci-backup-*.tar.gz" -o -name "tci-backup-*.tar.gz.enc" \) -mtime "+${RETENTION_DAYS}" -delete

echo "=== Sauvegarde terminée ==="
