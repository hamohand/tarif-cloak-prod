# CLAUDE.md

Ce fichier fournit les repères essentiels pour travailler sur ce dépôt : l'édition unique **Box Locale Algérie (`DZ`)** de **TCI / Intradia**.

> **Historique Git & Gouvernance des deux branches** : les versions SaaS (`prod` / `staging` / UE / Stripe / Chargily) sont conservées sur la branche durable `main` (ainsi que le tag `archive/saas-prod-staging-2026`, commit `a861b32`), destinée au SaaS UE puis au futur SaaS `.dz`. La présente branche porte l'édition autonome Box Locale `DZ`, tout en gardant `search-service/` portable entre les deux branches — voir [`docs/PRODUCT_EDITIONS_ROADMAP.md`](docs/PRODUCT_EDITIONS_ROADMAP.md).

## Architecture de la Box Locale (`DZ`)

Toute la pile tourne sur une seule machine locale sur le LAN du client (`docker-compose.yml` + `.env.example`, aucun port entrant ouvert sur Internet) :

| Service | Rôle | Port interne | Source |
| :--- | :--- | :--- | :--- |
| `traefik` | Reverse proxy HTTPS DNS-01 (Cloudflare) sur le LAN | `80`, `443` | `docker-compose.yml` |
| `backend` | API REST Spring Boot 3.4 / Java 21, licences Ed25519, quotas, collaborateurs, Flyway | `8081` | `backend/` |
| `search-service` | Recherche en cascade SH + lots asynchrones via Ollama (`AI_PROVIDER=${AI_PROVIDER:-ollama}`) | `8082` | `search-service/` |
| `frontend` | Application Angular 20 (marché `DZ`, polices locales dans `frontend/public/fonts/`) servie par Nginx | `80` | `frontend/` |
| `keycloak` + `keycloak-db` | Authentification locale OIDC / PKCE | `8080` | `keycloak/` |
| `app-db` | PostgreSQL 16 (nomenclature, organisations, logs, état licence `onprem_license_state`) | `5432` | `sql/sql/` + Flyway `V0_1..V35` |
| `rabbitmq` + `redis` | Messagerie inter-services et cache / file locale de lots | `5672` / `6379` | — |
| `ollama` *(profil `linux-gpu`)* | Runtime LLM local NVIDIA (sur Mac Mini M4 Pro, Ollama tourne nativement sur macOS Metal) | `11434` | — |
| `support-tunnel` *(profil `support`)* | Conteneur Tailscale SSH coupé par défaut | — | `scripts/support-tunnel.sh` |

## Conventions importantes

- **Pas de bascules `prod` / `staging` / `betaMode` / `deploymentMode`** : une seule configuration simple centrée sur la Box Locale Algérie (`marketVersion: 'DZ'`, devise `DZD` / `DA`).
- **Bootstrap & collaborateurs hors-ligne** : `BoxBootstrapInitializer` initialise l'organisation cliente et son admin Keycloak au premier démarrage (`BOOTSTRAP_ENABLED=true`). Les collaborateurs sont créés directement dans Keycloak sans dépendre de SMTP (`SMTP_ENABLED=false`).
- **Licences Ed25519** : `backend/src/main/java/com/muhend/backend/license/` vérifie localement les jetons `TCI1.<payload>.<signature>` (utilitaire `scripts/GenerateLicense.java`) avec protection anti-rollback d'horloge et grâce hors-ligne (`OFFLINE_GRACE_DAYS=30`).
- **Fournisseur IA** : `AI_PROVIDER` est configuré par défaut sur `ollama` (`search-service/src/main/resources/application.yml` et `docker-compose.yml`), tout en restant surchargeable par configuration.

## Commandes de développement & tests

### Java / Maven (tests unitaires)
Sur Windows avec Java 21 + Maven, passer l'agent ByteBuddy à Surefire pour Mockito :

```powershell
# search-service
mvn test -o "-DargLine=-javaagent:$env:USERPROFILE\.m2\repository\net\bytebuddy\byte-buddy-agent\1.17.8\byte-buddy-agent-1.17.8.jar"

# backend (tests unitaires hors tests d'intégration Testcontainers)
mvn test -o "-Dtest=Ed25519LicenseVerifierTest,LicenseServiceTest,PlanChangeServiceTest,QuotaServiceTest,QuotaExceededExceptionTest" "-DargLine=-javaagent:$env:USERPROFILE\.m2\repository\net\bytebuddy\byte-buddy-agent\1.17.8\byte-buddy-agent-1.17.8.jar"
```

### Utilitaires & Exploitation Box
- Clés et licences Ed25519 : `java scripts/GenerateLicense.java --gen-keys` / `--sign` / `--verify`
- Préparation polices hors-ligne : `./scripts/download-fonts.sh`
- Sauvegarde locale chiffrée AES-256 : `./scripts/backup-local.sh`
- Mise à jour Pull-only : `./scripts/pull-update.sh`
- Tunnel d'assistance temporaire : `./scripts/support-tunnel.sh {enable|disable|status}`
- Vérification script env Angular : `node --check frontend/generate-env.js`
