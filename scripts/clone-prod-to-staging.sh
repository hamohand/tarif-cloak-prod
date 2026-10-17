#!/bin/bash
# scripts/clone-prod-to-staging.sh
# Copie la dernière sauvegarde de la BDD de PRODUCTION vers la BDD de STAGING.
# Lecture seule côté prod (on ne lit que les fichiers de sauvegarde).
# Refuse de s'exécuter si la cible n'est pas le conteneur staging.
#
# Usage : ./scripts/clone-prod-to-staging.sh [--yes]
#   --yes : ne pas demander de confirmation (usage non interactif)
set -euo pipefail

# Répertoire du projet = parent du dossier scripts/ (fonctionne quel que soit le chemin)
COMPOSE_DIR="${COMPOSE_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups-hscode}"
TARGET_CONTAINER="${TARGET_CONTAINER:-staging-app-db}"
ENV_FILE="${ENV_FILE:-.env.staging}"

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
gzip -t "$LATEST"

echo "Source : $LATEST"
echo "Cible  : $TARGET_CONTAINER (les données staging seront ÉCRASÉES)"
if [[ "${1:-}" != "--yes" ]]; then
  read -r -p "Confirmer ? (tapez 'staging') : " CONFIRM
  [[ "$CONFIRM" == "staging" ]] || { echo "Annulé."; exit 1; }
fi

# Arrêt des services staging (connexions + migrations Flyway) pendant la restauration
cd "$COMPOSE_DIR"
docker compose --env-file "$ENV_FILE" -f docker-compose-staging.yml stop backend-staging search-service-staging

# Repartir d'un schéma vierge : évite les conflits d'objets/contraintes avec l'ancien contenu staging
docker exec -i "$TARGET_CONTAINER" sh -c 'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"' </dev/null

# Le dump contient des 'ALTER ... OWNER TO <role prod>' : le rôle staging est différent,
# on retire ces lignes. Les identifiants sont ceux du conteneur cible (POSTGRES_* internes).
zcat "$LATEST" \
  | sed -E '/^ALTER .* OWNER TO /d' \
  | docker exec -i "$TARGET_CONTAINER" sh -c 'psql -q -v ON_ERROR_STOP=0 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  2>&1 | grep -vE '^(NOTICE|DETAIL|HINT)' | head -30 || true

echo "Redémarrage des services staging..."
docker compose --env-file "$ENV_FILE" -f docker-compose-staging.yml up -d backend-staging search-service-staging
echo "Terminé."
