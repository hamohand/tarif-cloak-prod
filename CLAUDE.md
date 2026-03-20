# CLAUDE.md – Contexte du projet pour Claude Code

## Vue d'ensemble

Application SaaS de recherche de codes HS (harmonized system) pour le commerce international.
Les utilisateurs soumettent des termes de recherche, l'IA retourne les codes HS correspondants.

**Stack principale :**
- Frontend : Angular (port 4200)
- Backend : Spring Boot 3.5 / Java 21 (port 8081)
- Search-service : Spring Boot / Java 21 (port 8082) — moteur IA
- Auth : Keycloak 22 (port 8080)
- BDD : PostgreSQL 16
- Proxy : Traefik (production)

## Structure du projet

```
tarif-cloak-prod/
├── backend/           # API REST principale (utilisateurs, pricing-plans, organisations)
├── frontend/          # Application Angular
├── search-service/    # Microservice IA (recherche HS-codes, batch API)
├── keycloak/          # Configuration realm Keycloak
├── docker-compose-dev.yml
├── docker-compose-prod.yml
├── .env.dev           # Variables dev (template pour .env sur VPS)
└── .env               # NE PAS COMMITER — uniquement sur le VPS
```

## Commandes clés

```bash
# Développement local
docker compose -f docker-compose-dev.yml up -d --build

# Production (sur VPS, nécessite .env)
docker compose -f docker-compose-prod.yml up -d --build

# Rebuild d'un seul service
docker compose -f docker-compose-prod.yml up -d --build backend
docker compose -f docker-compose-prod.yml up -d --build search-service

# Logs
docker compose -f docker-compose-prod.yml logs -f backend
docker compose -f docker-compose-prod.yml logs -f search-service
```

## Architecture IA (search-service)

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

### Endpoints batch
- `POST /api/batch-search/submit` — soumettre un lot
- `GET  /api/batch-search/status/{id}` — statut
- `GET  /api/batch-search/results/{id}` — résultats
- `POST /api/batch-search/cancel/{id}` — annuler

## Routage Traefik (production)

| Service | Règle | Priorité |
|---|---|---|
| frontend | Host + PathPrefix(`/`) | 1 |
| backend | Host + PathPrefix(`/api`) | 10 |
| search-service | Host + PathPrefix(`/api/recherche`, `/api/batch-search`) | 20 |

**Important :** search-service a priorité 20, donc ses routes doivent être précises.
Ne pas ajouter `/api/swagger-ui` à search-service (intercepterait le swagger du backend).

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
```

Le fichier `.env.dev` sert de template — copier vers `.env` sur le VPS et adapter.

## Décodage P10 — `DecodeP10Controller`

Route : `GET /api/decode-p10?code=XXXX` — recherche inverse pure SQL (sans IA, sans quota).

Accepte 2, 4, 6 ou 10 chiffres et retourne la hiérarchie complète (section → chapitre → position4 → position6 → position10).

### Titres hiérarchiques (codes `code=''`)

Dans la table `position10_dz`, les lignes avec `code=''` sont des **titres de catégorie** préfixés par `"- "` (1 tiret = niveau 1, `"- - "` = niveau 2, etc.).

**Algorithme `findTitres`** (pour un code unique, niveau POSITION10) :
- Remonte les ids décroissants depuis le code P10
- Cherche le premier titre avec `nb_tirets < n_tirets` courant
- Si ce titre a **≤ 1 tiret → STOP total** (frontière de section, aucun titre affiché)
- Sinon : ajoute le titre, décrémente `n_tirets`, recommence
- Arrêt quand `n_tirets = 1`

**Algorithme `buildTitresParCode`** (pour une liste de codes, niveau POSITION6) :
- Étape 1 : `findTitres` pour le premier code (les titres précédant le 1er code ont des ids < MIN des codes, exclus de la requête de plage)
- Étape 2 : parcourt `findAllWithContextByPrefix` (plage MIN..MAX ids), maintient une pile de titres
- Titre à **1 tiret → vide la pile** (frontière de section), ne l'ajoute pas
- Titre à **≥ 2 tirets → met à jour la pile** (remplace les niveaux ≥ niveau courant)

**Affichage frontend (delta)** : pour chaque code P10, seuls les titres qui **changent** par rapport au code précédent sont affichés (`titreDelta(current, prev)`).

## Navigation Frontend (tarif module)

Les 3 modes de recherche sont accessibles via :
- **Onglets** dans `frontend/.../tarif/home/tarif.component.ts` (barre de navigation persistante)
- **Cartes** sur la page d'accueil `frontend/.../shared/home/home.component.ts`

Routes :
- `/recherche/search` → Recherche d'article unique
- `/recherche/searchListLots` → Recherche par liste
- `/recherche/batch-search` → Recherche par lots (async)

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

### UX frontend selon le rôle (plan bloqué)

| Rôle | Navbar | Page d'accueil |
| --- | --- | --- |
| ORGANIZATION | Bouton "HS-code ⚠️" → modal avec "Renouveler" + "Changer de plan" | Message blocage + liens vers stats |
| COLLABORATOR | **Bouton HS-code masqué complètement** | Message blocage + "contacter l'admin" |

- Modal de renouvellement : également accessible depuis `/organization/stats` via bannière de blocage
- `renewCurrentPlan()` : déclenche Chargily checkout avec le `pricingPlanId` actuel
- `scrollToChangePlan()` : fait défiler vers la section de sélection de plan dans stats
- Service frontend : `frontend/.../core/services/payment.service.ts` — `createCheckout(request)`
- Plans gratuits (prix = 0) : activés directement via `PUT /api/user/organization/pricing-plan` sans Chargily

## Paiement Chargily Pay

Intégration Chargily Pay v2 pour les paiements en DZD (CIB / EDAHABIA).

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
  "invoice_id": "1"   // optionnel
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

- `tarif-cloak-prod` (à la racine) : fichier `.env` de production mal nommé — ignoré par git, ne jamais commiter
- `.env` et `.env.*` : ignorés par git
- Le vrai `.env` de production est uniquement sur le VPS

## Conventions de code

- **Backend** : DTOs avec Lombok (`@Data @Builder`), validation Jakarta (`@NotBlank`, `@Size`)
- **Exceptions** : `GlobalExceptionHandler` gère `IllegalArgumentException` → 400, `RuntimeException` → 500
- **Sécurité** : double `SecurityFilterChain` (public Order 1, protégé Order 2)
- **CSV export** : toujours ajouter BOM UTF-8 (`\uFEFF`) pour compatibilité Excel

## Documentation existante

- [ARCHITECTURE.md](ARCHITECTURE.md) — architecture détaillée
- [CONFIGURATION.md](CONFIGURATION.md) — toutes les variables d'environnement
- [search-service/BATCH_API_GUIDE.md](search-service/BATCH_API_GUIDE.md) — guide batch API
- [docs/PLAN_FACTURATION.md](docs/PLAN_FACTURATION.md) — système de facturation
