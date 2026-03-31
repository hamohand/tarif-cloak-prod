# Architecture de l'Application

## 📋 Vue d'Ensemble

Application SaaS de recherche de codes tarifaires HS-code avec authentification Keycloak, gestion multi-organisations, facturation et quotas.

### Stack Technologique

- **Frontend** : Angular 20, TypeScript, RxJS
- **Backend** : Spring Boot 3.5.6, Java 21, Spring Security OAuth2
- **Base de données** : PostgreSQL 16
- **Authentification** : Keycloak 22.0.1
- **Infrastructure** : Docker, Docker Compose, Traefik (reverse proxy)

## 🏗️ Architecture Globale

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT (Browser)                        │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Traefik (Reverse Proxy)                    │
└────────────┬───────────────────────┬────────────────────────┘
             │                       │
             ▼                       ▼
┌─────────────────────┐   ┌─────────────────────┐
│   Frontend          │   │   Backend           │
│   Angular + Nginx   │   │   Spring Boot       │
│   :4200             │   │   :8081             │
└─────────────────────┘   └───────┬─────────────┘
                                   │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
        ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │  Keycloak    │  │  PostgreSQL  │  │  PostgreSQL  │
        │  (Auth)      │  │  (App DB)    │  │ (Keycloak DB)│
        │  :8080       │  │  :5432       │  │  :5432       │
        └──────────────┘  └──────────────┘  └──────────────┘
```

## 📊 Modèle de Données

### Entités Principales

#### Organization (Organisation)
- `id` : Identifiant unique
- `name` : Nom de l'organisation
- `email`, `address`, `phone` : Informations de contact
- `monthlyQuota` : Quota mensuel (null = illimité)
- `pricingPlanId` : ID du plan tarifaire actif
- `trialExpiresAt` : Date d'expiration de l'essai gratuit
- `trialPermanentlyExpired` : Flag indiquant si l'essai est définitivement terminé
- `monthlyPlanStartDate` : Date de début du cycle mensuel actuel (pour plans mensuels)
- `monthlyPlanEndDate` : Date de fin du cycle mensuel (inclus, réinitialisation le jour suivant)
- `pendingMonthlyPlanId` : Plan mensuel en attente (prendra effet à la fin du cycle)
- `pendingMonthlyPlanChangeDate` : Date à laquelle le changement de plan prendra effet
- `lastPayPerRequestInvoiceDate` : Date de la dernière facture pay-per-request
- `pendingPayPerRequestPlanId` : Plan Pay-per-Request en attente (si changement demandé)
- `pendingPayPerRequestChangeDate` : Date d'effet du changement vers Pay-per-Request
- `marketVersion` : Version du marché (ex: DEFAULT, DZ)

#### OrganizationUser (Liaison Utilisateur-Organisation)
- `id` : Identifiant unique
- `keycloakUserId` : ID utilisateur Keycloak
- `organizationId` : ID de l'organisation
- `joinedAt` : Date d'adhésion

#### UsageLog (Log d'Utilisation)
- `id` : Identifiant unique
- `keycloakUserId` : ID utilisateur
- `organizationId` : ID organisation
- `endpoint` : Endpoint appelé (ex: `/recherche/sections`)
- `searchTerm` : Terme de recherche
- `tokensUsed` : Tokens OpenAI utilisés
- `costUsd` : Coût en USD
- `timestamp` : Date/heure de la requête

#### PricingPlan (Plan Tarifaire)
- `id` : Identifiant unique
- `name` : Nom du plan
- `description` : Description
- `pricePerMonth` : Prix mensuel (null pour plans pay-per-request)
- `pricePerRequest` : Prix par requête (null pour plans mensuels)
- `monthlyQuota` : Quota mensuel (null = illimité)
- `trialPeriodDays` : Nombre de jours d'essai gratuit
- `isActive` : Plan actif/inactif
- `marketVersion` : Version marché (ex: "DZ" pour Algérie)

## 🔄 Flux Principaux

### 1. Authentification et Autorisation

```
Client → Keycloak (login) → JWT Token → Backend (validation) → Accès autorisé
```

- Authentification OAuth2/OpenID Connect via Keycloak
- JWT tokens avec rôles et organisation ID
- Spring Security pour la validation des tokens
- Guards Angular pour la protection des routes

### 2. Recherche de Code avec Tracking

```
Frontend → RechercheController → checkQuota() → AiService → OpenAI API
                                      ↓
                                  UsageLogService (save)
                                      ↓
                                  PostgreSQL
```

- Vérification du quota avant chaque requête
- Tracking automatique de l'utilisation
- Calcul des coûts OpenAI
- Enregistrement asynchrone des logs

### 3. Gestion des Quotas

```
checkQuota() → OrganizationService → PostgreSQL
    ↓
Vérification:
- Plan pay-per-request → quota illimité (null)
- Plan mensuel → vérification utilisation/mois
- Essai gratuit → vérification quota et date expiration
```

**Logique des quotas** :
- `monthlyQuota = null` → Quota illimité (plans pay-per-request)
- `monthlyQuota > 0` → Quota limité (plans mensuels avec quota)
- Essai gratuit : quota de 20 requêtes pendant 7 jours

### 4. Changement de Plan Tarifaire

```
Frontend → OrganizationAccountController → OrganizationService.changePricingPlan()
    ↓
Mise à jour selon le type de changement:
- Plan Mensuel → Plan Mensuel : Changement en attente (pendingMonthlyPlanId)
- Plan Mensuel → Pay-per-Request : Immédiat si quota dépassé, sinon en attente
- Pay-per-Request → Plan Mensuel : Immédiat + initialisation cycle mensuel
- Autres changements : Immédiat
```

**Règles de changement de plan** :
- Plan pay-per-request (`pricePerRequest > 0` et `pricePerMonth = null`) → `monthlyQuota = null`
- Plan mensuel avec quota → `monthlyQuota = plan.monthlyQuota` + cycle mensuel initialisé
- Plan mensuel sans quota → `monthlyQuota = null` + cycle mensuel initialisé
- Changements mensuels → mensuels : Enregistrés en attente jusqu'à la fin du cycle
- Changements mensuels → Pay-per-Request : Immédiat si quota dépassé, sinon en attente

**Cycle mensuel** :
- Le cycle commence le jour J et se termine le jour J-1 du mois suivant (inclus)
- Exemple : Cycle du 15 janvier au 14 février (inclus), renouvellement le 15 février
- Reconduction tacite automatique à la fin de chaque cycle
- La date de renouvellement est affichée dans l'interface utilisateur

## 🔐 Sécurité

### Rôles Keycloak
- `ADMIN` : Accès complet à l'administration
- `USER` : Utilisateur standard
- `ORGANIZATION_ADMIN` : Administrateur d'organisation

### Protection des Endpoints

```java
@PreAuthorize("hasRole('ADMIN')")
@GetMapping("/admin/organizations")
public List<OrganizationDto> getAllOrganizations() { ... }

@PreAuthorize("isAuthenticated()")
@GetMapping("/organization/me")
public OrganizationDto getMyOrganization() { ... }
```

### Guards Angular
- `authGuard` : Vérifie l'authentification
- `organizationGuard` : Vérifie l'appartenance à une organisation
- `adminGuard` : Vérifie le rôle ADMIN

## 📱 Structure Frontend

```
frontend/src/app/
├── core/                    # Services, guards, interceptors
│   ├── auth/               # Service d'authentification
│   ├── guards/             # Guards de routes
│   └── interceptors/       # HTTP interceptors
├── features/               # Modules fonctionnels
│   ├── organization/       # Gestion des organisations
│   ├── pricing/            # Plans tarifaires
│   └── search/             # Recherche de codes
└── shared/                 # Composants partagés
    ├── components/         # Composants réutilisables
    └── services/           # Services partagés
```

## 🔧 Structure Backend

```
backend/src/main/java/com/muhend/backend/
├── auth/                   # Authentification Keycloak
│   ├── config/            # Configuration Spring Security
│   └── service/           # Services Keycloak
├── organization/          # Gestion des organisations
│   ├── controller/       # Contrôleurs REST
│   ├── service/           # Services métier
│   ├── model/             # Entités JPA
│   └── repository/        # Repositories JPA
├── pricing/               # Plans tarifaires
│   ├── controller/
│   ├── service/
│   └── model/
├── codesearch/            # Recherche de codes
│   ├── controller/       # RechercheController
│   └── service/          # AiService, OpenAiService
└── usage/                 # Tracking d'utilisation
    ├── service/          # UsageLogService
    └── repository/       # UsageLogRepository
```

## 🚀 Environnements et Déploiement

Le développement en local (localhost) est **officiellement abandonné** afin de garantir une iso-parité parfaite avec l'infrastructure de production (gestion HTTPS, Traefik, Keycloak). 
L'environnement de **Staging** (déployé sur le VPS) fait désormais office d'environnement de développement et de test principal.

### Docker Compose

Services principaux déployés :
- `frontend` : Application Angular servie par Nginx
- `backend` : Application Spring Boot principale
- `search-service` : Microservice IA
- `keycloak` : Serveur d'authentification
- `postgres` : Base de données principale
- `keycloak-db` : Base de données isolée pour Keycloak
- `rabbitmq` : Broker de messages pour les batchs IA

### Variables d'Environnement

Toutes les configurations sont centralisées dans `.env`. Voir `CONFIGURATION.md` pour la liste complète.

### Traefik (Production)

- Reverse proxy avec SSL/TLS automatique
- Routing basé sur les domaines
- Load balancing
- Health checks

## 📈 Monitoring et Métriques

### Logs
- Logs structurés avec SLF4J
- Niveaux : DEBUG, INFO, WARN, ERROR
- Logs Docker via `docker compose logs`

### Métriques Business
- Nombre de requêtes par organisation
- Utilisation des quotas
- Coûts OpenAI par organisation
- Revenus par plan tarifaire

## 🔄 Phases d'Implémentation

### Phase 1 : Tracking Basique ✅
- Enregistrement des recherches avec coûts
- Entité `UsageLog`
- Service de logging

### Phase 2 : Associations Utilisateur-Organisation ✅
- Entités `Organization` et `OrganizationUser`
- Gestion multi-organisations
- Endpoints d'administration

### Phase 3 : Visualisation ✅
- Tableaux de bord de consommation
- Statistiques par organisation
- Historique des requêtes

### Phase 4 : Quotas ✅
- Vérification des quotas avant chaque requête
- Gestion des plans tarifaires
- Essai gratuit avec limite
- Blocage automatique si quota dépassé

### Phase 5 : Facturation ✅
- Génération de factures mensuelles et Pay-per-Request
- Historique des factures
- Export PDF
- Factures de clôture lors des changements de plan
- Reconduction tacite des plans mensuels
- Gestion des changements de plan en attente

## 📝 Notes d'Implémentation

### Performance
- Index sur `organization_id`, `timestamp`, `keycloakUserId` dans `UsageLog`
- Cache des informations de quota
- Enregistrement asynchrone des logs

### Sécurité
- Validation JWT à chaque requête
- Vérification des rôles et organisations
- Protection CSRF
- HTTPS en production

### Scalabilité
- Architecture microservices
- Base de données optimisée avec index
- Logs asynchrones
- Cache pour les données fréquemment accédées

---

*Dernière mise à jour : Phase 5 complétée - Système de facturation complet avec cycles mensuels et reconduction tacite*

