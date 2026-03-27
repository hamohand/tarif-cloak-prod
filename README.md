# Intradia — Classification pour le commerce international

Application SaaS de recherche et de décodage de codes de nomenclature douanière (système harmonisé HS), alimentée par l'intelligence artificielle.

## Table des matières

- [Fonctionnalités](#fonctionnalités)
- [Architecture](#architecture)
- [Technologies](#technologies)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Commandes utiles](#commandes-utiles)
- [Documentation](#documentation)
- [Troubleshooting](#troubleshooting)

---

## Fonctionnalités

- **Recherche HS-code** : saisie libre en toute langue, l'IA retourne la position tarifaire la plus pertinente avec justification (10 crédits)
- **Recherche Position10** : descente jusqu'au niveau sous-position avec titres hiérarchiques (15 crédits)
- **Décodage inverse HS** : à partir d'un code 2, 4 ou 6 chiffres, retourne la hiérarchie section → chapitre → position6 (2 crédits)
- **Décodage inverse P10** : à partir d'un code 2, 4, 6 ou 10 chiffres, retourne la hiérarchie complète avec titres (5 crédits)
- **Recherche par liste** : traitement simultané de plusieurs produits
- **Recherche par lots** : jusqu'à 1 000 articles en traitement asynchrone (API batch OpenAI / Anthropic)
- **Gestion multi-organisations** : invitation de collaborateurs, suivi de l'utilisation par organisation
- **Plans tarifaires** : essai gratuit, plans mensuels avec quotas en crédits, paiement Chargily Pay (DZD)
- **Facturation** : factures, historique, alertes de quota
- **Authentification** OAuth2 / OpenID Connect via Keycloak

---

## Architecture

```plaintext
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                          │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Traefik (Reverse Proxy / TLS)                   │
└──────┬──────────────────┬──────────────────┬─────────────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────┐  ┌──────────────────┐  ┌───────────────────┐
│  Frontend   │  │  Backend         │  │  Search-service   │
│  Angular    │  │  Spring Boot     │  │  Spring Boot + IA │
│  :80        │  │  :8081           │  │  :8082            │
└─────────────┘  └────────┬─────────┘  └────────┬──────────┘
                           │                     │
              ┌────────────┼─────────────────────┤
              ▼            ▼                     ▼
       ┌──────────┐  ┌──────────┐         ┌──────────┐
       │ Keycloak │  │PostgreSQL│         │ RabbitMQ │
       │  :8080   │  │  :5432   │         │  :5672   │
       └──────────┘  └──────────┘         └──────────┘
```

### Routage Traefik (production)

| Chemin                                   | Service        | Priorité |
| ---------------------------------------- | -------------- | -------- |
| `/`                                      | Frontend       | 1        |
| `/api`                                   | Backend        | 10       |
| `/api/recherche`, `/api/batch-search`    | Search-service | 20       |
| `/api/webhooks`                          | Backend        | 15       |

---

## Technologies

### Frontend

- Angular 20 — composants standalone
- TypeScript 5
- angular-oauth2-oidc (authentification Keycloak)

### Backend

- Spring Boot 3.5 / Java 21
- Spring Security OAuth2 Resource Server (JWT)
- Spring Data JPA / Hibernate + Flyway (migrations)
- RabbitMQ (communication avec search-service)
- SpringDoc OpenAPI (Swagger)

### Search-service

- Spring Boot / Java 21
- OpenAI API (gpt-4.1-mini par défaut), Anthropic, Ollama
- Architecture RAG en cascade : Sections → Chapitres → Positions4 → Positions6 → Positions10
- Batch API (traitement asynchrone jusqu'à 1 000 articles)

### Infrastructure

- Docker & Docker Compose
- Keycloak 22 (authentification)
- PostgreSQL 16
- RabbitMQ
- Traefik (reverse proxy, TLS Let's Encrypt)

---

## Prérequis

- Docker ≥ 20.10
- Docker Compose ≥ 2.0
- Git
- (Optionnel) Node.js 18+ pour le développement frontend
- (Optionnel) JDK 21+ et Maven pour le développement backend

---

## Installation

### 1. Cloner le projet

```bash
git clone <url-du-repo>
cd tarif-cloak-prod
```

### 2. Créer le fichier `.env`

Éditer `.env` avec vos valeurs. Variables minimales à renseigner :

```env
POSTGRES_PASSWORD=...
KEYCLOAK_BACKEND_CLIENT_SECRET=...
OPENAI_API_KEY=...
SMTP_USERNAME=...
SMTP_PASSWORD=...
FRONTEND_DOMAIN=...
WWW_FRONTEND_DOMAIN=...
```

Consultez [CONFIGURATION.md](CONFIGURATION.md) pour la liste complète.

### 3. Démarrer les services

```bash
# Développement local
docker compose -f docker-compose-dev.yml up -d --build

# Production
docker compose -f docker-compose-prod.yml up -d --build
```

### 4. Accéder à l'application

- Frontend : `https://votre-domaine.com`
- Swagger backend : `https://votre-domaine.com/api/swagger-ui/index.html`
- Keycloak admin : `https://auth.votre-domaine.com`

---

## Configuration

Toutes les variables sont centralisées dans `.env`. Voir [CONFIGURATION.md](CONFIGURATION.md) pour le détail complet.

Variables sensibles à changer impérativement en production :

```env
POSTGRES_PASSWORD
KEYCLOAK_BACKEND_CLIENT_SECRET
OPENAI_API_KEY          # ou ANTHROPIC_API_KEY
CHARGILY_SECRET_KEY
CHARGILY_WEBHOOK_SECRET
SMTP_PASSWORD
```

---

## Commandes utiles

```bash
# Rebuild d'un seul service
docker compose -f docker-compose-prod.yml up -d --build backend
docker compose -f docker-compose-prod.yml up -d --build search-service
docker compose -f docker-compose-prod.yml up -d --build frontend

# Logs en temps réel
docker compose -f docker-compose-prod.yml logs -f backend
docker compose -f docker-compose-prod.yml logs -f search-service

# Backup de la base de données
docker exec app-db pg_dump -U muhend hscode-app-db > backup_$(date +%Y%m%d).sql

# Restauration
docker exec -i app-db psql -U muhend hscode-app-db < backup.sql

# Réinitialisation complète
docker compose -f docker-compose-prod.yml down --volumes --remove-orphans
```

---

## Documentation

| Fichier | Contenu |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Architecture détaillée, modèle de données, flux |
| [CONFIGURATION.md](CONFIGURATION.md) | Toutes les variables d'environnement |
| [search-service/BATCH_API_GUIDE.md](search-service/BATCH_API_GUIDE.md) | Guide de l'API batch |
| [docs/PLAN_FACTURATION.md](docs/PLAN_FACTURATION.md) | Système de facturation, plans, crédits |
| [docs/MARKET_PROFILE.md](docs/MARKET_PROFILE.md) | Profils de marché (devises, langues) |
| [CLAUDE.md](CLAUDE.md) | Contexte technique pour Claude Code |

---

## Troubleshooting

### Le backend ne démarre pas

```bash
docker compose -f docker-compose-prod.yml logs backend
docker compose -f docker-compose-prod.yml ps keycloak
```

### Erreur 403 à l'inscription

Le service account `backend-client` manque de rôles Keycloak :

1. Keycloak Admin → realm `hscode-realm` → **Clients** → `backend-client` → **Service Account Roles**
2. Ajouter : `manage-users`, `view-users`, `query-users`

### Webhook Chargily non reçu

- Vérifier que l'URL `https://votre-domaine.com/api/webhooks/chargily` est configurée dans le dashboard Chargily
- Vérifier `CHARGILY_WEBHOOK_SECRET` dans `.env`
- Consulter les logs : `docker compose logs -f backend | grep webhook`

### Quota non décompté correctement

Le calcul des crédits se fait dans `OrganizationService.computeCredits()` selon l'endpoint appelé.
Valeurs configurables dans `.env` : `CREDITS_POSITIONS10`, `CREDITS_POSITIONS6`, `CREDITS_DECODE_P10`, `CREDITS_DECODE`.

---

Intradia — Enclume Numérique
