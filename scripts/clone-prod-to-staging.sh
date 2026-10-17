#!/bin/bash
# scripts/clone-prod-to-staging.sh
# Copie la dernière sauvegarde de la BDD de PRODUCTION vers la BDD de STAGING.
# Lecture seule côté prod (on ne lit que les fichiers de sauvegarde).
# Refuse de s'exécuter si la cible n'est pas le conteneur staging.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/root/backups-hscode}"
TARGET_CONTAINER="${TARGET_CONTAINER:-staging-app-db}"
COMPOSE_DIR="${COMPOSE_DIR:-/root/tarif-cloak-prod}"

# --- Garde-fou : ne jamais viser la prod ---
if [[ "$TARGET_CONTAINER" != staging-* ]]; then
  echo "ERREUR : la cible '$TARGET_CONTAINER' n'est pas un conteneur staging. Abandon." >&2
  exit 1
fi
if ! docker inspect "$TARGET_CONTAINER" >/dev/null 2>&1; then
  echo "ERREUR : conteneur '$TARGET_CONTAINER' introuvable (docker compose ... up -d app-db-staging ?)." >&2
  exit 1
fi

LATEST="$(ls -t "$BACKUP_DIR"/app-db-*.sql.gz 2>/dev/null | head -1 || true)"
if [[ -z "$LATEST" ]]; then
  echo "ERREUR : aucune sauvegarde app-db-*.sql.gz dans $BACKUP_DIR" >&2
  exit 1
fi

echo "Source : $LATEST"
echo "Cible  : $TARGET_CONTAINER (les données staging seront ÉCRASÉES)"
read -r -p "Confirmer ? (tapez 'staging') : " CONFIRM
[[ "$CONFIRM" == "staging" ]] || { echo "Annulé."; exit 1; }

# Les identifiants sont ceux du conteneur cible (variables POSTGRES_* internes)
zcat "$LATEST" | docker exec -i "$TARGET_CONTAINER" sh -c 'psql -v ON_ERROR_STOP=0 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

echo "Redémarrage de la stack staging..."
cd "$COMPOSE_DIR"
docker compose --env-file .env.staging -f docker-compose-staging.yml restart backend-staging search-service-staging
echo "Terminé."
