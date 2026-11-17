# CLAUDE.md – Contexte du projet pour Claude Code

## Vue d'ensemble

**TCI (Tarif du Commerce International)** — Application SaaS de recherche de codes HS (harmonized system) pour le commerce international.
Les utilisateurs soumettent des termes de recherche, l'IA retourne les codes HS correspondants avec hiérarchie complète et justification.

**Stack principale :**
- Frontend : Angular 20 standalone (port 4200)
- Backend : Spring Boot 3.5 / Java 21 (port 8081)
- Search-service : Spring Boot / Java 21 (port 8082) — moteur IA
- Auth : Keycloak 22 (port 8080)
- BDD : PostgreSQL 16
- Proxy : Traefik (production)

## Structure du projet

```
tci/
├── backend/            # API REST principale (organisations, plans, paiements, décodage, devis)
├── frontend/           # Application Angular 20 (nginx.conf unique)
├── search-service/     # Microservice IA (classification HS/P10/NC8, batch API)
├── keycloak/           # Configuration realm Keycloak (realm-export.json & thèmes)
├── scripts/            # Scripts de sauvegarde et d'import tarifaire
├── docker-compose.yml  # Orchestration unique de la branche active
├── .env.example        # Gabarit versionné des variables de la branche active
└── .env                # Secrets locaux/VPS (ignoré par Git)
```

## Les 3 branches actives du projet

L'ancienne distinction `prod` / `staging` est abandonnée (son historique reste figé dans `main` et les tags `archive/*`). Le dépôt ne s'articule plus qu'autour de **3 branches**, chacune pilotée par un unique `docker-compose.yml` et un unique `.env` :

| Branche | Rôle | Particularités |
| --- | --- | --- |
| **`saas-dz-ue`** | **SaaS Cloud standard (`DZ` + `UE`)** | Nomenclatures DZ (P10 enrichi DGD) + UE 2026 (NC8), comparateur `DZ ↔ UE`, double marché `DA` (Chargily) / `EUR` (Stripe) + repli facture, devis publics, quotas visiteurs Internet stricts. |
| **`saas-conference`** | **SaaS Conférence / Démo publique** | Identique à `saas-dz-ue`, avec quotas visiteurs et limites de débit relevés par défaut pour supporter le Wi-Fi NAT partagé d'une salle de conférence et URL Chargily de test par défaut. |
| **`dz-localization`** | **Box Locale Algérie (100 % sur site)** | Dérivée de `saas-dz-ue` (`V41` licence `Ed25519` hors-ligne `TCI1...`), moteur IA local **Ollama**, Keycloak local sans SMTP externe, polices WOFF2 hors-ligne, HTTPS LAN DNS-01. |

## Commandes clés

```bash
# Démarrer / mettre à jour la branche active (lit automatiquement .env)
docker compose up -d --build

# Reconstruire un seul service
docker compose up -d --build backend
docker compose up -d --build search-service
docker compose up -d --build frontend

# Vérifier la syntaxe Docker Compose
docker compose config -q

# Logs en temps réel
docker compose logs -f backend
docker compose logs -f search-service

# Changer d'édition SaaS (ex. passer en mode conférence puis revenir au SaaS standard)
git checkout saas-conference && docker compose up -d --build
git checkout saas-dz-ue && docker compose up -d --build

# Sauvegarde PostgreSQL
./scripts/backup-db.sh

# --- TESTS ---

# Backend (unitaires + intégration, utilise Testcontainers PostgreSQL)
cd backend && mvn test
cd backend && mvn test -Dtest=NomDeLaClasse        # test unitaire unique
cd backend && mvn test -Dtest=NomDeLaClasse#method # méthode unique

# Search-service
cd search-service && mvn test

# Frontend
cd frontend && npm test
```

### Conteneurs (`PROJECT_NAME=tci` par défaut)

| Conteneur | Rôle |
|---|---|
| `tci-app-db` | PostgreSQL 16 (nomenclatures DZ + UE auto-chargées par Flyway `V0_1`→`V40`) |
| `tci-backend` | API Spring Boot 3.5 |
| `tci-search-service` | Microservice IA de recherche douanière |
| `tci-frontend` | Angular 20 servi par Nginx |
| `tci-rabbitmq` / `tci-redis` | Broker de messages & cache |
| `tci-keycloak` *(profil `--profile keycloak`)* | Keycloak embarqué optionnel (par défaut, utilise le Keycloak externe `KEYCLOAK_EXTERNAL_URL`) |

## Migrations de base de données (Flyway)

**Outil :** Flyway (`baseline-on-migrate: true`, `out-of-order: true`, `validate-on-migrate: true`)

**Convention de nommage :** `V{n}__{description}.sql` — ex: `V1__create_pricing_plan_table.sql`, `V32__add_trial_renew_count.sql`

**Emplacement :** `backend/src/main/resources/db/migration/`

Les migrations sont appliquées automatiquement au démarrage du backend. Pour ajouter une migration, créer un nouveau fichier SQL avec le prochain numéro de version. Ne jamais modifier un fichier de migration déjà appliqué en production.

La documentation des index de performance est dans `backend/src/main/resources/db/migration/README_INDEXES.md`.

## Modèle de données

```
Organization
  ├── pricingPlanId → PricingPlan (plan courant)
  ├── ← OrganizationUser (M-1, liste des collaborateurs via keycloakUserId)
  ├── ← UsageLog (M-1, logs de consommation IA)
  ├── ← Invoice (M-1, factures)
  └── ← QuotaAlert (M-1, alertes quota)
```

**Entités principales :**

| Entité | Champs clés |
|---|---|
| `Organization` | name, email, marketVersion, keycloakUserId, monthlyQuota, pricingPlanId, monthlyPlanStartDate, monthlyPlanEndDate, trialRenewCount, enabled |
| `OrganizationUser` | keycloakUserId, organizationId (clé composite unique) |
| `PricingPlan` | name, marketVersion, pricePerMonth, monthlyQuota, isCustom, organizationId |
| `UsageLog` | keycloakUserId, organizationId, endpoint, searchTerm, tokensUsed, costUsd |
| `Invoice` | organizationId, pricingPlanId |
| `Position10Dz` / `Position6Dz` | code, description (données HS, readonly) |
| `PendingRegistration` | email, activityDomain, otp (inscription en attente) |

## Structure des packages backend

**Racine :** `backend/src/main/java/com/muhend/backend/`

| Package | Contenu |
|---|---|
| `admin/` | Gestion admin, nettoyage utilisateurs |
| `alert/` | Alertes quota (controller, service, model) |
| `auth/` | Inscription, OTP, authentification |
| `codesearch/` | Décodage P10, recherche hiérarchie HS |
| `config/` | SecurityFilterChain, OpenAPI, CORS |
| `email/` | Envoi emails SMTP |
| `exception/` | `GlobalExceptionHandler` |
| `flyway/` | Callbacks Flyway |
| `internal/` | Endpoints internes (quota check, stats) |
| `invoice/` | Facturation |
| `market/` | Profils marché (`MarketProfile`) |
| `organization/` | Gestion organisations et collaborateurs |
| `payment/` | Intégrations Chargily / Stripe |
| `pricing/` | Plans tarifaires |
| `usage/` | Logs d'utilisation IA |
| `user/` | Gestion utilisateurs Keycloak |

## Mode Beta (`BETA_MODE`)

Le frontend lit `environment.betaMode` (injecté via `ARG BETA_MODE` dans le Dockerfile).

Quand `BETA_MODE=true` :

- **Inscription** : plan Invité assigné automatiquement (via `DEFAULT_PLAN_NAME=Invité` côté backend)
- **Sidebar organisation** : Factures et Demandes de devis masquées
- **Navbar principale** : Alertes masquées, lien Tarifs masqué
- **Page d'accueil** : bouton "Ouvrir l'espace organisation" masqué, badge offre Invité visible
- **Plan bloqué** : redirige vers `/access-expired` (page de remerciement) au lieu de `/choose-plan`
- **Bannière quota épuisé** : fond vert, message de remerciement sur deux lignes
- **Stats organisation** : section plan simplifiée (info fixe Invité, pas de changement de plan)
- **Réinitialisation admin** : limitée à 1 fois par organisation (`trialRenewCount`)

## Architecture IA (search-service)

### Les 3 modes de recherche

**Mode 1 — Recherche article unique (cascade niveau par niveau) :**
- Endpoints : `GET /recherche/{niveau}?termeRecherche=...`
- Niveaux : `sections` → `chapitres` → `positions4` → `positions6` → `positions10`
- Chaque niveau appelle `AiService` → `OpenAiProvider` / `AnthropicProvider` / `OllamaProvider`
- La justification n'est générée qu'au dernier niveau (`withJustification=true`)

**Mode 2 — Recherche par liste :**
- Route frontend : `/recherche/searchListLots`
- Implémentation : le frontend boucle sur les endpoints unitaires du mode 1 en séquence

**Mode 3 — Recherche par lots asynchrone (Batch API) :**
- `POST /batch-search/submit` — soumettre un lot (max 1 000 items)
- `GET /batch-search/status/{batchId}` — statut du lot
- `GET /batch-search/results/{batchId}` — résultats
- `POST /batch-search/cancel/{batchId}` — annuler
- Providers : `AnthropicBatchProvider`, `OpenAiBatchProvider` (Ollama non supporté)

### Providers standard (requêtes unitaires)

- `AiService` → route vers `OpenAiProvider`, `AnthropicProvider`, ou `OllamaProvider`
- Sélection via variable `AI_PROVIDER` (openai | anthropic | ollama)
- `AiProvider.demanderAiAide(titre, question, withJustification)` — le paramètre `withJustification` contrôle le system message

### Justification — stratégie d'optimisation des coûts

- La justification est activée **uniquement au dernier niveau** de la cascade IA
- Niveaux intermédiaires (L0-L3) : `withJustification = false` → system message plus court, output minimal
- Dernier niveau (ex: L4 pour Position10, L3 pour HScode) : `withJustification = true` → justification en français
- Économie estimée : ~40% sur les tokens output des niveaux intermédiaires
- Si le dernier niveau échoue et qu'un niveau précédent est utilisé en fallback, les résultats n'ont pas de justification

### Providers batch (requêtes en lot)

- `BatchService` → route vers `AnthropicBatchProvider` ou `OpenAiBatchProvider`
- Interface commune : `BatchProvider`
- Modèles partagés dans `batch/models/` : `SearchRequest`, `BatchStatus`, `BatchResult`
- Ollama ne supporte PAS le batch

## Routage Traefik (production)

| Service | Règle | Priorité |
|---|---|---|
| frontend | Host + PathPrefix(`/`) | 1 |
| backend | Host + PathPrefix(`/api`) | 10 |
| search-service | Host + PathPrefix(`/api/recherche`, `/api/batch-search`) | 20 |

**Important :**

- `search-service` a priorité 20, donc ses routes doivent être précises.
- Ne pas ajouter `/api/swagger-ui` à search-service (intercepterait le swagger du backend).
- **Protection DDoS / Quotas API** : `search-service` utilise le middleware `search-ratelimit` (5 req/sec en moyenne) défini dans Traefik pour bloquer les requêtes abusives qui feraient exploser la facture OpenAI.

## Keycloak

**Realm :** `hscode-realm` — fichier exporté : `keycloak/realm-export.json`

**Rôles applicatifs :**

| Rôle | Droits |
|---|---|
| `ADMIN` | Accès complet, interface admin |
| `ORGANIZATION` | Compte organisation, peut inviter des collaborateurs |
| `COLLABORATOR` | Membre d'une organisation, accès restreint |
| `USER` | Rôle de base |

**Configuration Spring Boot :**
- Validation tokens : `issuer-uri: ${KEYCLOAK_EXTERNAL_URL}/realms/${KEYCLOAK_REALM}`
- Clés publiques : `jwk-set-uri: ${KEYCLOAK_INTERNAL_URL}/realms/.../certs`
- Clients Keycloak déclarés : `frontend-client`, `backend-client`

**Ne jamais modifier** la configuration du realm (flows, scopes, clients) sans vérifier l'impact sur staging et prod (Keycloak est partagé).

## Swagger / OpenAPI

- Backend Swagger : `https://[domaine]/api/swagger-ui/index.html`
- Authentification : JWT Bearer via Keycloak
- Token récupérable via l'endpoint `/api/auth/token` ou la console Keycloak
- La config globale JWT est dans `backend/.../config/OpenApiConfig.java`

## Pricing Plans

Entité avec les champs : `name`, `marketVersion`, `currency`, `isCustom`, `organizationId`, `isActive`, `displayOrder`.

- `marketVersion` : code marché (ex: `DZ`, `FR`, `DEFAULT`)
- Plans publics : `organizationId = null`
- Plans custom : `isCustom = true`, liés à une organisation

Endpoints :

- `GET /api/pricing-plans` — liste tous les plans
- `GET /api/pricing-plans/market/{marketVersion}` — par marché
- `POST /api/pricing-plans` — créer (ADMIN)
- `PUT /api/pricing-plans/{id}` — modifier (ADMIN)
- `DELETE /api/pricing-plans/{id}` — supprimer (ADMIN)

## Variables d'environnement importantes

Définies dans `.env` (uniquement sur VPS, ne jamais commiter) :

```
AI_PROVIDER=openai|anthropic|ollama
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
MARKET_VERSION=DZ
FRONTEND_DOMAIN=...
WWW_FRONTEND_DOMAIN=...
KEYCLOAK_DOMAIN=...
KEYCLOAK_REALM=hscode-realm
KEYCLOAK_ADMIN_USER=...
KEYCLOAK_ADMIN_PASSWORD=...

# Beta mode
BETA_MODE=true                  # Injecté dans le build Angular via Dockerfile ARG
DEFAULT_PLAN_NAME=Invité        # Plan assigné automatiquement à l'inscription (backend)

# Paiement
CHARGILY_API_KEY=...
CHARGILY_SECRET_KEY=...
```

Le fichier `.env.dev` sert de template — copier vers `.env` sur le VPS et adapter.

## Décodage P10 — `DecodeP10Controller`

Route : `GET /api/decode-p10?code=XXXX` — recherche inverse pure SQL (sans IA, sans quota).

Accepte 2, 4, 6 ou 10 chiffres et retourne la hiérarchie complète (section → chapitre → position4 → position6 → position10).

### Titres hiérarchiques (codes `code=''`)

Dans la table `position10_dz`, les lignes avec `code=''` sont des **titres de catégorie** préfixés par `"- "` (1 tiret = niveau 1, `"- - "` = niveau 2, etc.). L'algorithme remonte les ids pour trouver les titres parents applicables à un code donné.

**Affichage frontend (delta)** : pour chaque code P10, seuls les titres qui **changent** par rapport au code précédent sont affichés (`titreDelta(current, prev)`).

## Navigation Frontend

### Routes principales

- `/` — Page d'accueil
- `/aide` — Guide d'utilisation (**public**, pas d'auth requise)
- `/auth/register` — Inscription (plan Invité assigné automatiquement en beta)
- `/recherche/search` → Recherche d'article unique
- `/recherche/searchListLots` → Recherche par liste
- `/recherche/batch-search` → Recherche par lots (async)
- `/choose-plan` — Choix / renouvellement de plan (mode normal uniquement)
- `/access-expired` — Page de fin d'accès (mode beta uniquement)

### Guards

- `authGuard` — authentification requise
- `collaboratorGuard` — compte org ou collaborateur requis
- `organizationGuard` — compte org uniquement
- `planRequiredGuard` — vérifie `canMakeRequests` ; redirige vers `/access-expired` (betaMode) ou `/choose-plan` (!betaMode) si bloqué. Appliqué sur `recherche`, `dashboard`, `alerts`.

### Compteur de crédits (sidebar)

Affiché dans la sidebar organisation via `getMyOrganization()` :

- Vert si > 50% restants, orange entre 20–50%, rouge sous 20%
- Masqué si `monthlyQuota == null` (plan illimité)
- Rafraîchi toutes les 30 secondes

## Facturation — Stratégie actuelle

- **Pas de pay-per-request** : modèle supprimé, seuls les plans mensuels et l'essai gratuit subsistent
- **Pas de renouvellement automatique** : le plan expire à `monthlyPlanEndDate`, l'accès HS-code est bloqué
- **Blocage dans 2 cas** : plan expiré (1 mois écoulé) OU quota consommé avant terme
- **Réactivation** : le client choisit manuellement un nouveau plan via paiement Chargily
- Point d'entrée du contrôle d'accès : `InternalController.checkQuota()` → `OrganizationService.canOrganizationMakeRequests()`

### Logique de blocage — `canOrganizationMakeRequests()`

Vérifications dans l'ordre :

1. Organisation désactivée par l'admin → `false`
2. Essai gratuit expiré (`isTrialExpired()`) → `false`
3. Plan mensuel expiré (`LocalDate.now().isAfter(monthlyPlanEndDate)`) → `false`
4. Quota mensuel épuisé (pour les plans payants avec `monthlyQuota != null`) → `false`
5. Sinon → `true`

### Champ `trialRenewCount` (Organisation)

Limite la réinitialisation du plan Invité à **1 fois** par organisation.

- Incrémenté dans `PlanChangeService.resetPlan()` après chaque reset
- Si `trialRenewCount >= 1`, un second reset lève `IllegalStateException`
- Visible dans l'interface admin : bouton "Réinitialiser" masqué et remplacé par badge "✅ Déjà renouvelé"

### UX frontend selon le mode et le rôle (plan bloqué)

| Mode | Rôle | Comportement |
| --- | --- | --- |
| Normal | ORGANIZATION | Modal → `/choose-plan` |
| Normal | COLLABORATOR | Bouton HS-code masqué |
| Beta | ORGANIZATION | Bannière verte + `/access-expired` |
| Beta | COLLABORATOR | Bouton HS-code masqué |

## Paiement Chargily Pay

Intégration Chargily Pay v2 pour les paiements en DZD (CIB / EDAHABIA). **Non utilisé en mode beta.**

### Flux de paiement

1. Frontend appelle `POST /api/payments/chargily/checkout` → backend crée un checkout via l'API Chargily
2. Backend retourne un `checkout_url` → frontend redirige l'utilisateur
3. L'utilisateur paie sur la page Chargily
4. Chargily envoie un webhook `checkout.paid` → backend active le plan automatiquement

### Webhook

- **URL** : `https://[domaine]/api/webhooks/chargily` (public, pas d'auth JWT)
- **Contrôleur** : `ChargilyWebhookController` — vérifie la signature HMAC-SHA256
- **Événements gérés** : `checkout.paid`, `checkout.failed`, `checkout.canceled`
- **Activation du plan** : `OrganizationService.activatePlanAfterPayment(organizationId, planId)` appelée sur `checkout.paid`

### Metadata transmises à Chargily

```json
{
  "organization_id": "6",
  "pricing_plan_id": "9",
  "invoice_id": "1"
}
```

### Configuration

```
CHARGILY_API_KEY=...      # Clé secrète Chargily (test ou live)
CHARGILY_SECRET_KEY=...   # Clé de signature webhook
```

- Dashboard test : `https://pay.chargily.com/test/dashboard/developers-corner`
- Dashboard live : `https://pay.chargily.com/dashboard/developers-corner`
- Routage Traefik : `/api/webhooks/**` → backend (strip `/api`), backend voit `/webhooks/chargily`

## Fichiers sensibles

- `.env` à la racine : fichier de production — ignoré par git, ne jamais commiter
- `.env` et `.env.*` : ignorés par git
- Le vrai `.env` de production est uniquement sur le VPS

## Conventions de code

- **Backend** : DTOs avec Lombok (`@Data @Builder`), validation Jakarta (`@NotBlank`, `@Size`)
- **Exceptions** : `GlobalExceptionHandler` gère `IllegalArgumentException` → 400, `RuntimeException` → 500
- **Sécurité** : double `SecurityFilterChain` (public Order 1, protégé Order 2)
- **CSV export** : toujours ajouter BOM UTF-8 (`﻿`) pour compatibilité Excel

## Documentation existante

- [ARCHITECTURE.md](ARCHITECTURE.md) — architecture détaillée
- [CONFIGURATION.md](CONFIGURATION.md) — toutes les variables d'environnement
- [search-service/BATCH_API_GUIDE.md](search-service/BATCH_API_GUIDE.md) — guide batch API
- [docs/PLAN_FACTURATION.md](docs/PLAN_FACTURATION.md) — système de facturation
- [docs/STRATEGIE_COMMERCIALE.md](docs/STRATEGIE_COMMERCIALE.md) — stratégie de lancement
