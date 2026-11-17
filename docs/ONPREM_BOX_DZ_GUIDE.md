# Guide d'Architecture & Déploiement — Box Locale Algérie (DZ)

Ce guide décrit le déploiement de **TCI / Intradia** en édition unique **100 % locale (Box Locale Algérie)** sur le réseau local (LAN) d'une entreprise cliente.

---

## 1. Conformité juridique & souveraineté des données (Algérie)

En déployant l'ensemble de la pile applicative **et** le moteur d'intelligence artificielle sur un boîtier physique installé dans les locaux de l'entreprise cliente :

- **Loi n° 18-07 (art. 44, 45, 67, 70) & Loi n° 25-11 (24 juillet 2025)** : aucune donnée à caractère personnel (comptes collaborateurs, noms, emails, logs de recherche, fichiers Excel/CSV) ni aucune description de marchandise ne quitte le territoire algérien ou le LAN du client. Aucun appel n'est effectué vers des API externes ou Google Fonts.
- **Loi n° 18-05 (art. 8)** & **secteurs régulés** : la solution n'externalise aucun traitement sur un cloud étranger et répond aux exigences des DSI d'entreprises publiques, banques, transitaires et grands importateurs.
- **Heartbeat de licence (optionnel)** : s'il est activé (`LICENSE_HEARTBEAT_URL`), le backend n'envoie qu'un JSON minimal contenant `{ "boxId", "licenseId", "timestamp" }` — **zéro donnée personnelle, zéro terme de recherche, zéro information d'entreprise**. En cas de coupure Internet prolongée, la période de grâce hors-ligne (`OFFLINE_GRACE_DAYS=30`) maintient le service actif.

---

## 2. Dimensionnement matériel de la « Box IA »

Le moteur `search-service` enchaîne jusqu'à **5 appels LLM séquentiels** en cascade (`SECTIONS` → `CHAPITRES` → `POSITIONS4` → `POSITIONS6` → `POSITIONS10`) avec un contexte de `16 384` tokens (`OLLAMA_NUM_CTX=16384`) incluant les notes légales douanières.

Toute la pile Docker hors IA (`backend`, `search-service`, `keycloak`, `postgres`, `redis`, `rabbitmq`, `traefik`, `nginx`) ne consomme que **~3 à 3,5 Go de RAM** pour 1 à 5 utilisateurs. Côté modèle Ollama, en activant l'optimisation mémoire (`OLLAMA_FLASH_ATTENTION=1` et `OLLAMA_KV_CACHE_TYPE=q8_0`), `qwen2.5:7b` (Q4_K_M) pèse **4,7 Go** (~6 Go avec le contexte 16k) et `qwen2.5:14b` pèse **9,0 Go** (~10,5 Go avec contexte `q8_0`).

| Palier cible | Matériel réaliste | Modèle Ollama conseillé | Vitesse & usage |
| :--- | :--- | :--- | :--- |
| **Palier 1 — Déclarant solo / Petit cabinet (1–3 utilisateurs)** | **Option PC abordable** : PC de bureau (Core i5 / Ryzen 5, **16 Go RAM**, SSD 256–512 Go, LUKS/BitLocker) + **NVIDIA RTX 3060 12 Go** *(très courante en Algérie)* ou **RTX 4060 8 Go**<br>**Option Mac compact** : **Mac Mini M4 de base (16 Go mémoire unifiée / SSD 256 Go, FileVault)** | `qwen2.5:14b` sur RTX 3060 12 Go<br>`qwen2.5:7b` sur GPU 8 Go ou Mac Mini M4 16 Go (`OLLAMA_MODEL=qwen2.5:7b`) | **~8 à 20 s** par recherche complète (5 niveaux) |
| **Palier 2 — Cabinet de transit / PME (5–15 utilisateurs)** | **Mac Mini M4 24 Go** (ou M4 Pro) · ou PC **32 Go RAM + NVIDIA RTX 4060 Ti 16 Go / RTX 3060 12 Go** · SSD 512 Go+ | `qwen2.5:14b` | **~8 à 15 s** par recherche · silencieux (Mac) ou profil `--profile linux-gpu` (Linux) |
| **Palier 3 — Grand importateur / Groupe (15–30+ utilisateurs)** | **Mac Mini M4 Pro 48 Go** · ou Serveur Linux **GPU NVIDIA RTX 4070 Ti Super / 4090 / RTX A4000+ (16 à 24 Go VRAM)**, 32 Go+ RAM, Ubuntu 24.04 LTS | `qwen2.5:14b` ou `qwen2.5:32b` | **~5 à 10 s** par recherche + traitement par lots intensif |

> **Pourquoi éviter le mode CPU seul (sans GPU ni Apple Silicon) ?**  
> Sur un PC 16 Go sans carte graphique dédiée, `qwen2.5:7b` fonctionne techniquement mais la lecture répétée des nomenclatures sur 5 niveaux prend **45 s à 2 min** par produit (contre ~8 à 20 s avec une RTX 3060 ou un Mac Mini M4). Pour les déclarants indépendants ne souhaitant aucun matériel dédié, la future offre hébergée **SaaS `.dz`** (Phase 3 décrite dans [`PRODUCT_EDITIONS_ROADMAP.md`](PRODUCT_EDITIONS_ROADMAP.md)) répondra à ce besoin sans investissement matériel.

> **Note de sécurité physique :** activez systématiquement **FileVault** (macOS), **LUKS2** (Linux) ou **BitLocker** (Windows) lors de la préparation en atelier afin que les bases PostgreSQL (`app-db`, `keycloak-db`) et modèles locaux soient protégés en cas de vol physique du boîtier.

---

## 3. Réseau LAN & Certificat HTTPS valide sans ouvrir de port entrant

Angular OIDC (`PKCE`) et Keycloak 22 requièrent un contexte navigateur sécurisé (`https://`). Pour éviter les avertissements de certificat auto-signé sur tous les postes du client **sans ouvrir aucun port entrant sur le routeur de l'entreprise** :

1. Attribuez à la Box une IP fixe sur le LAN du client (ex. `192.168.1.50`).
2. Créez deux enregistrements DNS `A` sur votre zone DNS (ex. Cloudflare) pointant directement vers l'IP privée LAN :
   - `client1.box.enclume-numerique.com` → `192.168.1.50`
   - `auth.client1.box.enclume-numerique.com` → `192.168.1.50`
3. Dans `.env` (basé sur [`.env.example`](../.env.example)), configurez `ACME_DNS_PROVIDER=cloudflare` et un token API restreint uniquement aux enregistrements DNS TXT (`CF_DNS_API_TOKEN`).
4. Traefik (dans [`docker-compose.yml`](../docker-compose.yml)) obtient automatiquement un certificat Let's Encrypt valide via le challenge **DNS-01** en ne faisant qu'un appel **sortant**. Tous les PC du LAN accèdent à `https://client1.box.enclume-numerique.com` avec un cadenas vert immédiat.

---

## 4. Cycle de vie des clés & licences `Ed25519`

L'utilitaire autonome [`scripts/GenerateLicense.java`](../scripts/GenerateLicense.java) fonctionne sans Maven avec Java 21 standard.

### 4.1 Générer la paire de clés éditeur (une seule fois, hors-ligne)

```bash
java scripts/GenerateLicense.java --gen-keys
```

- Conservez `TCI_LICENSE_PRIVATE_KEY` strictement en sécurité chez vous.
- Copiez `LICENSE_PUBLIC_KEY` dans le `.env` de chaque Box.

### 4.2 Signer une licence client

```bash
java scripts/GenerateLicense.java --sign \
  --private-key "$TCI_LICENSE_PRIVATE_KEY" \
  --license-id "LIC-DZ-2026-001" \
  --box-id "box-client1-dz" \
  --org "Entreprise Cliente Alger SARL" \
  --plan "Box Enterprise" \
  --expires "2027-11-16" \
  --max-users 25 \
  --grace-days 30
```

Le jeton généré (`TCI1.<payload>.<signature>`) peut être :
- pré-chargé via `LICENSE_TOKEN` dans `.env` ;
- collé ultérieurement par le client dans **Mon organisation → Licence Box IA Locale** (appel à `POST /api/license/activate`, stocké en base et dans `/data/license/license.jwt`).

### 4.3 Vérifier un jeton

```bash
java scripts/GenerateLicense.java --verify \
  --public-key "$LICENSE_PUBLIC_KEY" \
  --token "TCI1...."
```

---

## 5. Préparation et démarrage de la Box

### 5.1 Polices locales (zéro requête Google Fonts)

Lors de la préparation des sources/images en atelier (machine ayant accès Internet) :

```bash
chmod +x scripts/*.sh
./scripts/download-fonts.sh
```

Les polices `.woff2` sont alors servies localement par Nginx via [`frontend/public/fonts/fonts.css`](../frontend/public/fonts/fonts.css).

### 5.2 Démarrer Ollama

- **Sur Mac Mini M4 / M4 Pro (Metal natif)** :
  1. Installez Ollama sur macOS et lancez-le avec l'optimisation mémoire du cache KV :
     ```bash
     OLLAMA_HOST=0.0.0.0:11434 OLLAMA_FLASH_ATTENTION=1 OLLAMA_KV_CACHE_TYPE=q8_0 ollama serve
     ```
  2. Téléchargez le modèle adapté à la mémoire du Mac :
     - Mac Mini M4 **16 Go** : `ollama pull qwen2.5:7b` (et définissez `OLLAMA_MODEL=qwen2.5:7b` dans `.env`) ;
     - Mac Mini M4 / M4 Pro **24 Go+** : `ollama pull qwen2.5:14b`.
  3. Dans `.env`, laissez `OLLAMA_BASE_URL=http://host.docker.internal:11434`.
  4. Démarrez la stack :
     ```bash
     docker compose up -d --build
     ```

- **Sur Linux avec GPU NVIDIA** :
  1. Dans `.env`, définissez `OLLAMA_BASE_URL=http://ollama:11434` (et `OLLAMA_MODEL=qwen2.5:7b` si GPU 8 Go VRAM, ou `qwen2.5:14b` dès 12 Go VRAM comme une RTX 3060 12 Go).
  2. Démarrez la stack avec le profil GPU :
     ```bash
     docker compose --profile linux-gpu up -d --build
     ```
  3. Téléchargez le modèle dans le conteneur :
     ```bash
     docker exec -it box-ollama ollama pull qwen2.5:14b
     # Ou sur GPU 8 Go VRAM :
     docker exec -it box-ollama ollama pull qwen2.5:7b
     ```

### 5.3 Bootstrap automatique au premier démarrage

Au premier démarrage (`BOOTSTRAP_ENABLED=true`), [`BoxBootstrapInitializer`](../backend/src/main/java/com/muhend/backend/box/BoxBootstrapInitializer.java) crée automatiquement :
- le compte administrateur dans Keycloak (`ORG_EMAIL` / `ORG_PASSWORD`) avec les rôles `ORGANIZATION`, `USER`, `COLLABORATOR` ;
- l'organisation associée dans PostgreSQL (`country=DZ`, `marketVersion=DZ`).

Les collaborateurs ajoutés depuis **Mon organisation** sont créés directement dans Keycloak sans dépendre d'un serveur SMTP externe (`SMTP_ENABLED=false`) : un mot de passe temporaire est affiché avec bouton de copie et Keycloak impose son changement dès la première connexion.

---

## 6. Exploitation, mises à jour et support

| Opération | Commande | Détails |
| :--- | :--- | :--- |
| **Sauvegarde locale chiffrée** | `BACKUP_PASSPHRASE="..." ./scripts/backup-local.sh` | Exporte `app-db`, `keycloak-db` et `/data/license` en archive AES-256 locale (à programmer par cron vers NAS/USB). |
| **Mise à jour Pull-only** | `./scripts/pull-update.sh` | Sauvegarde préalable, `docker compose pull`, vérification optionnelle Cosign, redémarrage sans perte de volumes. |
| **Ouvrir le tunnel support** | `./scripts/support-tunnel.sh enable` | Démarre temporairement Tailscale (`--profile support`) à la demande expresse du client. |
| **Couper le tunnel support** | `./scripts/support-tunnel.sh disable` | Arrête et supprime le conteneur Tailscale immédiatement après l'intervention. |
