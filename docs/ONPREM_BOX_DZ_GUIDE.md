# Guide d'Installation Locale sur Ordinateur — `dz-localization`

Ce guide décrit l'installation et l'utilisation de **TCI (`dz-localization`)** **100 % en local sur un ordinateur** (PC Windows, Mac ou Linux), sans nom de domaine, sans certificat HTTPS externe et sans aucun envoi de données hors de la machine.

---

## 1. Démarrage rapide en 3 étapes (Windows / macOS / Linux)

### Prérequis sur l'ordinateur
1. **Docker Desktop** (Windows ou Mac) ou **Docker Engine + Compose** (Linux) démarré.
2. **Ollama** installé sur l'ordinateur ([ollama.com](https://ollama.com)).

### Étape 1 — Télécharger le modèle IA local léger (`qwen2.5:7b`, ~4,7 Go)

Ouvrez un terminal (PowerShell sur Windows, Terminal sur Mac/Linux) :

```bash
ollama pull qwen2.5:7b
```

> **Note Linux (sans Docker Desktop) :** exposez Ollama à l'interface Docker locale avec `OLLAMA_HOST=0.0.0.0:11434 ollama serve` (ou utilisez `docker compose --profile linux-gpu up -d --build` avec `OLLAMA_BASE_URL=http://ollama:11434` si vous avez un GPU NVIDIA sous Linux). Sur **Windows** et **Mac**, Docker Desktop joint automatiquement Ollama via `http://host.docker.internal:11434` sans réglage supplémentaire.

### Étape 2 — Créer le fichier `.env` prêt à l'emploi

Dans un dossier propre cloné sur la branche `dz-localization` :

- **Windows (PowerShell)** :
  ```powershell
  Copy-Item .env.example .env
  ```
- **macOS / Linux** :
  ```bash
  cp .env.example .env
  ```

Le fichier [`.env.example`](../.env.example) est déjà pré-rempli avec des identifiants locaux et une **licence de démonstration `Ed25519` valide** pour un essai immédiat.

### Étape 3 — Lancer l'application

```bash
docker compose up -d --build
```

Au premier lancement, PostgreSQL charge automatiquement toutes les nomenclatures douanières (`DZ` 10 chiffres + `UE` NC8) et crée le compte organisation initial dans Keycloak (~1 à 2 minutes).

### Accès dans le navigateur

| Service | Adresse locale | Identifiants pré-configurés |
| :--- | :--- | :--- |
| **Application TCI (`dz-localization`)** | **`http://localhost:8088`** | **`admin@local.dz`** / **`AdminLocal2026!`** |
| **Console d'administration Keycloak** | `http://localhost:8085` | `admin` / `LocalKeycloakAdmin2026!` |

> Les conteneurs internes (`app-db`, `keycloak-db`, `rabbitmq`, `redis`, `backend`, `search-service`) restent isolés sur le réseau Docker interne sans occuper les ports `80`, `443`, `5432`, `6379` ou `8080` de votre ordinateur. Si les ports `8088` ou `8085` sont déjà utilisés sur un poste, modifiez simplement `APP_PORT` et `KEYCLOAK_PORT` (ainsi que `FRONTEND_URL` et `KEYCLOAK_EXTERNAL_URL`) dans `.env`.

---

## 2. Choix du modèle Ollama selon l'ordinateur

| Type d'ordinateur | Modèle conseillé (`OLLAMA_MODEL` dans `.env`) | Mémoire requise | Vitesse indicative |
| :--- | :--- | :--- | :--- |
| **PC Windows / Mac courant (16 Go RAM, GPU 6–8 Go ou Apple Silicon M1–M4)** | **`qwen2.5:7b`** *(par défaut)* | ~5 à 6 Go | ~8 à 25 s par recherche (45 s–2 min si CPU seul sans GPU) |
| **PC avec GPU NVIDIA ≥ 12 Go VRAM (ex. RTX 3060 12 Go / 4070) ou Mac ≥ 24 Go** | `qwen2.5:14b` | ~10 Go | ~8 à 15 s par recherche avec finesse maximale |

---

## 3. Conformité juridique & souveraineté des données (Algérie)

En exécutant toute la pile applicative **et** le moteur IA directement sur le poste :

- **Loi n° 18-07 & Loi n° 25-11 (24 juillet 2025)** : aucune donnée personnelle (comptes, emails, journaux de recherche, fichiers CSV/Excel) ni aucune description commerciale de marchandise ne quitte l'ordinateur. Aucun appel n'est effectué vers des API Cloud ni vers Google Fonts.
- **Création locale des collaborateurs sans SMTP** (`SMTP_ENABLED=false`) : depuis **Mon organisation**, les comptes collaborateurs sont créés directement dans le Keycloak local avec un mot de passe temporaire copiable en un clic (à personnaliser dès la première connexion).

---

## 4. Livraison chez un client final : générer vos propres clés et licences `Ed25519`

Pour vos essais personnels sur votre ordinateur, la licence de démonstration incluse dans [`.env.example`](../.env.example) fonctionne immédiatement.  
Avant d'installer l'application sur l'ordinateur d'un **client commercial**, remplacez les mots de passe locaux dans `.env` et signez une licence dédiée avec [`scripts/GenerateLicense.java`](../scripts/GenerateLicense.java) (Java 21 standard, sans Maven) :

### 4.1 Générer votre paire de clés éditeur (une seule fois, conservée chez vous)

```bash
java scripts/GenerateLicense.java --gen-keys
```

- Gardez **`TCI_LICENSE_PRIVATE_KEY`** strictement confidentielle hors du poste client.
- Placez **`LICENSE_PUBLIC_KEY`** dans le `.env` du poste client.

### 4.2 Signer un jeton de licence pour le client

```bash
java scripts/GenerateLicense.java --sign \
  --private-key "$TCI_LICENSE_PRIVATE_KEY" \
  --license-id "LIC-DZ-2026-001" \
  --box-id "poste-client1-dz" \
  --org "Cabinet Transit Alger SARL" \
  --plan "Licence Poste Local DZ" \
  --expires "2027-11-18" \
  --max-users 5 \
  --monthly-quota 5000 \
  --grace-days 30
```

Placez `BOX_ID=poste-client1-dz` et le jeton `TCI1...` obtenu dans `LICENSE_TOKEN` du `.env` client (ou collez-le dans **Mon organisation → Licence Box IA Locale**).
