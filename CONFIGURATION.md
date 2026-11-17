# Guide de Configuration — Box Locale Algérie (DZ)

Toute la configuration de la Box repose sur deux fichiers à la racine du projet :

- [`.env.example`](.env.example) : modèle complet à copier vers `.env`
- [`docker-compose.yml`](docker-compose.yml) : orchestration unique des services locaux

## Variables principales (`.env`)

### 1. Identité & domaines LAN (Traefik DNS-01)
| Variable | Exemple | Rôle |
| :--- | :--- | :--- |
| `PROJECT_NAME` | `box` | Préfixe des conteneurs et du réseau `webproxy` |
| `FRONTEND_DOMAIN` | `client1.box.enclume-numerique.com` | Domaine LAN pointant vers l'IP locale du boîtier |
| `KEYCLOAK_DOMAIN` | `auth.client1.box.enclume-numerique.com` | Domaine Keycloak LAN |
| `ACME_EMAIL` | `infra@enclume-numerique.com` | Email Let's Encrypt |
| `ACME_DNS_PROVIDER` | `cloudflare` | Fournisseur DNS pour le challenge DNS-01 |
| `CF_DNS_API_TOKEN` | `...` | Jeton API scoped DNS (aucun port entrant requis) |

### 2. Bases de données, Keycloak & RabbitMQ
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` : base applicative `app-db`
- `KEYCLOAK_DB`, `KEYCLOAK_DB_USER`, `KEYCLOAK_DB_PASSWORD` : base `keycloak-db`
- `KEYCLOAK_REALM` (`hscode-realm`), `KEYCLOAK_ADMIN_USER`, `KEYCLOAK_ADMIN_PASSWORD`, `KEYCLOAK_FRONTEND_CLIENT`, `KEYCLOAK_BACKEND_CLIENT`, `KEYCLOAK_BACKEND_CLIENT_SECRET`
- `RABBITMQ_USER`, `RABBITMQ_PASSWORD`

### 3. Moteur IA local (Ollama)
| Variable | Défaut | Description |
| :--- | :--- | :--- |
| `AI_PROVIDER` | `ollama` | Fournisseur actif (`ollama` par défaut, surchargeable) |
| `OLLAMA_BASE_URL` | `http://host.docker.internal:11434` | URL d'Ollama (`http://ollama:11434` sous Linux `--profile linux-gpu`) |
| `OLLAMA_MODEL` | `qwen2.5:14b` | Modèle utilisé pour la cascade SH |
| `OLLAMA_NUM_CTX` | `16384` | Taille de contexte (inclut les notes légales douanières) |
| `OLLAMA_KEEP_ALIVE` | `24h` | Durée de maintien du modèle en VRAM |
| `AI_HTTP_READ_TIMEOUT_MS` | `180000` | Timeout de lecture HTTP vers Ollama |
| `AI_BATCH_LOCAL_MAX_REQUESTS` | `300` | Nombre maximal d'articles par lot asynchrone local |

### 4. Bootstrap organisation & SMTP interne
- `BOOTSTRAP_ENABLED` (`true`) : crée l'organisation cliente et son compte admin au premier démarrage (`BoxBootstrapInitializer.java`).
- `ORG_NAME`, `ORG_EMAIL`, `ORG_PASSWORD`, `ORG_ADDRESS`, `ORG_PHONE`, `ORG_ACTIVITY_DOMAIN`.
- `SMTP_ENABLED` (`false`) : laisse l'envoi d'e-mails coupé par défaut afin qu'aucune donnée ne sorte du LAN.

### 5. Licence cryptographique `Ed25519`
- `BOX_ID` : identifiant unique du boîtier (lié aux licences dédiées)
- `LICENSE_PUBLIC_KEY` : clé publique Ed25519 Base64 générée par `java scripts/GenerateLicense.java --gen-keys`
- `LICENSE_TOKEN` : jeton initial `TCI1.<payload>.<signature>` (modifiable ensuite depuis **Mon organisation** dans l'interface)
- `OFFLINE_GRACE_DAYS` (`30`) : jours de tolérance après date d'expiration en mode hors-ligne
- `LICENSE_HEARTBEAT_URL` *(optionnel, vide par défaut)* : si renseigné, envoie uniquement `{ "boxId", "licenseId", "timestamp" }` sans aucune donnée métier ni PII

### 6. Sauvegardes & tunnel de support
- `BACKUP_DIR` (`/var/backups/tci-box`), `BACKUP_RETENTION_DAYS` (`30`), `BACKUP_PASSPHRASE` (chiffrement AES-256 via [`scripts/backup-local.sh`](scripts/backup-local.sh))
- `TAILSCALE_AUTHKEY` : clé Tailscale utilisée uniquement lorsque l'administrateur lance `./scripts/support-tunnel.sh enable`
