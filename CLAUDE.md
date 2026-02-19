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
