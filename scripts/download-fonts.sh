#!/usr/bin/env bash
# scripts/download-fonts.sh
# Télécharge localement les polices WOFF2 dans frontend/public/fonts/
# lors de la préparation de l'image en atelier afin d'éliminer tout appel
# à fonts.googleapis.com / fonts.gstatic.com sur le réseau local du client.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FONT_DIR="$(cd "${SCRIPT_DIR}/../frontend/public/fonts" && pwd)"

mkdir -p "${FONT_DIR}"

echo "Téléchargement des polices WOFF2 vers ${FONT_DIR}..."

curl -fsSL -o "${FONT_DIR}/Inter-Variable.woff2" \
  "https://github.com/rsms/inter/raw/master/docs/font-files/InterVariable.woff2" \
  || echo "Note: InterVariable.woff2 non téléchargé (fallback police système actif)."

curl -fsSL -o "${FONT_DIR}/SpaceGrotesk-Variable.woff2" \
  "https://github.com/floriankarsten/space-grotesk/raw/master/fonts/woff2/SpaceGrotesk%5Bwght%5D.woff2" \
  || echo "Note: SpaceGrotesk-Variable.woff2 non téléchargé (fallback police système actif)."

curl -fsSL -o "${FONT_DIR}/JetBrainsMono-Variable.woff2" \
  "https://github.com/JetBrains/JetBrainsMono/raw/master/fonts/variable/JetBrainsMono%5Bwght%5D.woff2" \
  || echo "Note: JetBrainsMono-Variable.woff2 non téléchargé (fallback police système actif)."

echo "Terminé."
ls -lh "${FONT_DIR}"
