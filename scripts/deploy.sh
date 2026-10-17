#!/bin/bash
# scripts/deploy.sh — déploiement unifié staging / prod
#
# Usage :
#   ./scripts/deploy.sh staging [service...]       # ex: ./scripts/deploy.sh staging backend-staging
#   ./scripts/deploy.sh prod    [service...]       # ex: ./scripts/deploy.sh prod backend
#   Options (n'importe où après l'environnement) :
#     --yes        ne pas demander de confirmation (prod)
#     --no-backup  ne pas sauvegarder les BDD avant un déploiement prod
#     --no-build   ne pas reconstruire les images (up -d seul)
#     --dry-run    simuler (aucun conteneur modifié)
#
# Équivalent à :
#   prod    : docker compose -f docker-compose-prod.yml up -d --build
#   staging : docker compose --env-file .env.staging -f docker-compose-staging.yml up -d --build
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ENVIRONMENT="${1:-}"
[[ -n "$ENVIRONMENT" ]] && shift || true

case "$ENVIRONMENT" in
  staging) COMPOSE_FILE="docker-compose-staging.yml"; ENV_ARGS=(--env-file .env.staging) ;;
  prod)    COMPOSE_FILE="docker-compose-prod.yml";    ENV_ARGS=() ;;
  *) echo "Usage : $0 staging|prod [service...] [--yes] [--no-backup] [--no-build] [--dry-run]" >&2; exit 1 ;;
esac

YES=0; BACKUP=1; BUILD=1; UP_ARGS=(); SERVICES=()
for a in "$@"; do
  case "$a" in
    --yes) YES=1 ;;
    --no-backup) BACKUP=0 ;;
    --no-build) BUILD=0 ;;
    --dry-run) UP_ARGS+=(--dry-run) ;;
    -*) echo "Option inconnue : $a" >&2; exit 1 ;;
    *) SERVICES+=("$a") ;;
  esac
done

[[ "${#ENV_ARGS[@]}" -gt 0 && ! -f ".env.staging" ]] && { echo "ERREUR : .env.staging introuvable (gabarit : .env.staging.example)." >&2; exit 1; }
[[ -f ".env" ]] || { echo "ERREUR : .env introuvable." >&2; exit 1; }

DRY=0; [[ " ${UP_ARGS[*]:-} " == *" --dry-run "* ]] && DRY=1

echo "Environnement : $ENVIRONMENT"
echo "Branche       : $(git branch --show-current 2>/dev/null || echo '?')  ($(git log --oneline -n 1 2>/dev/null || echo '?'))"
[[ "${#SERVICES[@]}" -gt 0 ]] && echo "Services      : ${SERVICES[*]}" || echo "Services      : tous"
[[ "$BUILD" -eq 1 ]] && echo "Build         : oui (--build)" || echo "Build         : non"

# Validation de la configuration avant toute action
docker compose "${ENV_ARGS[@]}" -f "$COMPOSE_FILE" config -q 2> >(grep -v 'level=warning' >&2)

if [[ "$ENVIRONMENT" == "prod" && "$DRY" -eq 0 ]]; then
  if [[ "$YES" -eq 0 ]]; then
    read -r -p "Déployer en PRODUCTION ? (tapez 'prod') : " CONFIRM
    [[ "$CONFIRM" == "prod" ]] || { echo "Annulé."; exit 1; }
  fi
  if [[ "$BACKUP" -eq 1 ]]; then
    echo "Sauvegarde des BDD avant déploiement..."
    bash scripts/backup-prod-dbs.sh
  fi
fi

[[ "$BUILD" -eq 1 ]] && UP_ARGS+=(--build)
docker compose "${ENV_ARGS[@]}" -f "$COMPOSE_FILE" up -d "${UP_ARGS[@]}" "${SERVICES[@]}"

[[ "$DRY" -eq 1 ]] || docker compose "${ENV_ARGS[@]}" -f "$COMPOSE_FILE" ps
