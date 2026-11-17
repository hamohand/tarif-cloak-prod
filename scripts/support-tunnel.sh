#!/usr/bin/env bash
# scripts/support-tunnel.sh
# Permet à l'administrateur client d'activer ou de couper instantanément
# le tunnel d'assistance Tailscale (désactivé par défaut).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.yml"

ACTION="${1:-status}"

cd "${PROJECT_DIR}"

case "${ACTION}" in
  enable)
    if [ -f ".env" ] && ! grep -q '^TAILSCALE_AUTHKEY=.\+' ".env"; then
      echo "Erreur: TAILSCALE_AUTHKEY doit être renseigné dans .env avant d'activer le support." >&2
      exit 1
    fi
    echo "Activation du tunnel de support Tailscale..."
    docker compose -f "${COMPOSE_FILE}" --profile support up -d support-tunnel
    echo "Tunnel de support ACTIF. Exécutez '$0 disable' dès la fin de l'intervention."
    ;;
  disable)
    echo "Arrêt et suppression du conteneur de support..."
    docker compose -f "${COMPOSE_FILE}" --profile support stop support-tunnel || true
    docker compose -f "${COMPOSE_FILE}" --profile support rm -f support-tunnel || true
    echo "Tunnel de support COUPÉ."
    ;;
  status)
    docker compose -f "${COMPOSE_FILE}" --profile support ps support-tunnel || true
    ;;
  *)
    echo "Usage: $0 {enable|disable|status}" >&2
    exit 1
    ;;
esac
