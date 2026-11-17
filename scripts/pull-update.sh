#!/usr/bin/env bash
# scripts/pull-update.sh
# Mise à jour "Pull-only" sécurisée d'une Box Locale Algérie.
# 1. Sauvegarde locale préalable des bases PostgreSQL
# 2. Téléchargement des nouvelles images signées depuis le registre
# 3. Vérification optionnelle des signatures Cosign (si COSIGN_PUB_KEY est défini)
# 4. Redéploiement sans perte des volumes (données, Keycloak, licence, modèles Ollama)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.yml"

cd "${PROJECT_DIR}"

if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

REGISTRY_PREFIX="${REGISTRY_PREFIX:-ghcr.io/enclume-numerique/tci}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
SERVICES=(backend search-service frontend)

echo "=== [1/4] Sauvegarde préalable des bases locales ==="
if [ -x "${SCRIPT_DIR}/backup-local.sh" ]; then
  "${SCRIPT_DIR}/backup-local.sh" || echo "Avertissement: sauvegarde préalable ignorée ou partielle."
fi

echo "=== [2/4] Téléchargement des images (${IMAGE_TAG}) ==="
docker compose -f "${COMPOSE_FILE}" pull "${SERVICES[@]}"

if [ -n "${COSIGN_PUB_KEY:-}" ] && command -v cosign >/dev/null 2>&1; then
  echo "=== [3/4] Vérification des signatures Cosign ==="
  for svc in "${SERVICES[@]}"; do
    img="${REGISTRY_PREFIX}/${svc}:${IMAGE_TAG}"
    echo "Vérification de ${img}..."
    cosign verify --key "${COSIGN_PUB_KEY}" "${img}"
  done
else
  echo "=== [3/4] Vérification Cosign ignorée (COSIGN_PUB_KEY ou binaire cosign absent) ==="
fi

echo "=== [4/4] Mise à jour des conteneurs (volumes préservés) ==="
docker compose -f "${COMPOSE_FILE}" up -d --no-deps "${SERVICES[@]}"

echo "=== Mise à jour terminée avec succès ==="
docker compose -f "${COMPOSE_FILE}" ps
