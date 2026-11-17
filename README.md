# TCI — Box Locale Algérie (DZ)

Solution souveraine de recherche et classification douanière par IA (**Système Harmonisé / nomenclature à 10 chiffres**), conçue pour fonctionner **100 % localement** sur le réseau interne (LAN) de l'entreprise cliente en Algérie.

> L'historique complet de l'architecture SaaS précédente est conservé sur la branche `main` et le tag Git `archive/saas-prod-staging-2026`.

## Points forts

- **Souveraineté totale des données** : base PostgreSQL, Keycloak, Redis, RabbitMQ et moteur IA **Ollama** hébergés localement sur la Box — aucune description de marchandise ni donnée collaborateur ne quitte le réseau client.
- **HTTPS transparent sur le LAN** : Traefik v3 avec certificat Let's Encrypt **DNS-01** sans ouvrir aucun port entrant sur le routeur de l'entreprise.
- **Licences cryptographiques hors-ligne (`Ed25519`)** : jetons `TCI1...` générés hors-ligne via [`scripts/GenerateLicense.java`](scripts/GenerateLicense.java), période de grâce configurable (`OFFLINE_GRACE_DAYS=30`) et protection anti-rollback d'horloge.
- **Autonomie complète** : création directe des comptes collaborateurs dans Keycloak sans serveur SMTP externe, polices web embarquées localement (`frontend/public/fonts/`).
- **Support maîtrisé par le client** : tunnel Tailscale arrêté par défaut, activable à la demande via [`scripts/support-tunnel.sh`](scripts/support-tunnel.sh).

## Démarrage rapide

1. Copier le modèle de configuration et renseigner les variables requises :
   ```bash
   cp .env.example .env
   ```
2. Générer la paire de clés Ed25519 et signer une licence client :
   ```bash
   java scripts/GenerateLicense.java --gen-keys
   java scripts/GenerateLicense.java --sign \
     --private-key "$TCI_LICENSE_PRIVATE_KEY" \
     --license-id "LIC-DZ-2026-001" \
     --box-id "box-client1-dz" \
     --org "Entreprise Cliente Alger SARL" \
     --plan "Box Enterprise" \
     --expires "2027-11-16"
   ```
3. *(En atelier, avec Internet)* Télécharger les polices locales :
   ```bash
   ./scripts/download-fonts.sh
   ```
4. Démarrer la Box :
   - **Mac Mini M4 Pro** (Ollama natif Metal) :
     ```bash
     docker compose up -d --build
     ```
   - **Mini-PC / Serveur Linux GPU NVIDIA** :
     ```bash
     docker compose --profile linux-gpu up -d --build
     ```

## Documentation complémentaire

- [`CONFIGURATION.md`](CONFIGURATION.md) — Référence complète des variables `.env`
- [`docs/ONPREM_BOX_DZ_GUIDE.md`](docs/ONPREM_BOX_DZ_GUIDE.md) — Guide complet de déploiement, matériel, réseau DNS-01, licences et exploitation
- [`docs/PRODUCT_EDITIONS_ROADMAP.md`](docs/PRODUCT_EDITIONS_ROADMAP.md) — Feuille de route des deux éditions (Box Locale DZ vs SaaS Cloud UE / futur `.dz`) et partage de `search-service`
- [`CLAUDE.md`](CLAUDE.md) — Guide développeur et commandes de test
