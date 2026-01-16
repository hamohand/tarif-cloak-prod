# Plan de Migration - Tarif Monolithe vers Micro-services

## Vue d'ensemble

Migration du module de recherche (`codesearch`) du monolithe `tarif-cloak-prod` vers un micro-service indépendant `search-service`.

### Structure des dossiers
```
tarif-cloak-prod/                    ← Dossier principal (monorepo)
├── docker-compose-prod.yml             (context: ./search-service)
├── .env
├── backend/                         ← Monolithe Spring Boot
├── frontend/                        ← Angular
├── keycloak/                        ← Config Keycloak
├── search-service/                  ← Micro-service de recherche
│   ├── src/
│   ├── pom.xml
│   └── Dockerfile
└── docs/                            ← Documentation
    ├── MIGRATION.md
    └── PROGRESS.md
```

---

## Phases de Migration

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 1          │  PHASE 2           │  PHASE 3          │  PHASE 4  │
│  Préparation      │  Développement     │  Intégration      │  Bascule  │
│                   │  search-service    │  & Tests          │  Prod     │
├───────────────────┼────────────────────┼───────────────────┼───────────┤
│  ✅ Terminé       │  ✅ Terminé        │  ✅ Terminé       │  ⏳ À faire │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1 : Préparation ✅

| Tâche | Statut | Description |
|-------|--------|-------------|
| Analyse architecture existante | ✅ | Cartographie du monolithe |
| Choix de l'approche | ✅ | Hybride (monolithe + 1 service) |
| Définition des contrats API | ✅ | Endpoints et événements |
| Création projet `tarif-micros` | ✅ | Structure de base |

---

## Phase 2 : Développement search-service ✅

### Étape 1 : Structure projet ✅

```
search-service/
├── pom.xml                           ✅
├── Dockerfile                        ✅
├── .dockerignore                     ✅
├── src/main/java/com/tarif/search/
│   ├── SearchServiceApplication.java ✅
│   └── ...
└── src/main/resources/
    └── application.yml               ✅
```

### Étape 2 : Modèles et Repositories ✅

| Fichier | Statut | Source monolithe |
|---------|--------|------------------|
| `model/Section.java` | ✅ | `codesearch/model/Section.java` |
| `model/Chapitre.java` | ✅ | `codesearch/model/Chapitre.java` |
| `model/Position4.java` | ✅ | `codesearch/model/Position4.java` |
| `model/Position6Dz.java` | ✅ | `codesearch/model/Position6Dz.java` |
| `model/Position.java` | ✅ | DTO pour réponses IA |
| `model/UsageInfo.java` | ✅ | Infos d'utilisation |
| `repository/*Repository.java` | ✅ | Interfaces JPA |

### Étape 3 : Services IA ✅

| Fichier | Statut | Description |
|---------|--------|-------------|
| `service/ai/AiProvider.java` | ✅ | Interface commune |
| `service/ai/AiService.java` | ✅ | Orchestrateur |
| `service/ai/OpenAiService.java` | ✅ | Intégration GPT |
| `service/ai/AnthropicService.java` | ✅ | Intégration Claude |
| `service/ai/OllamaService.java` | ✅ | Intégration locale |
| `service/ai/AiPrompts.java` | ✅ | Templates prompts |
| `service/ai/DefTheme.java` | ✅ | Options affichage |
| `service/ai/JsonUtils.java` | ✅ | Utilitaires JSON |

### Étape 4 : Services métier ✅

| Fichier | Statut | Description |
|---------|--------|-------------|
| `service/SectionService.java` | ✅ | Gestion sections |
| `service/ChapitreService.java` | ✅ | Gestion chapitres |
| `service/Position4Service.java` | ✅ | Gestion positions 4 |
| `service/Position6DzService.java` | ✅ | Gestion positions 6 |
| `service/SearchService.java` | ✅ | Logique de recherche cascade |

### Étape 5 : Contrôleur ✅

| Fichier | Statut | Description |
|---------|--------|-------------|
| `controller/RechercheController.java` | ✅ | Endpoints `/recherche/*` |
| `dto/QuotaCheckResponse.java` | ✅ | DTO quota |

### Étape 6 : Client Feign ✅

| Fichier | Statut | Description |
|---------|--------|-------------|
| `client/BackendClient.java` | ✅ | Interface Feign |
| `client/BackendFallback.java` | ✅ | Fallback circuit breaker |
| `config/FeignConfig.java` | ✅ | Configuration + auth |

### Étape 7 : Événements RabbitMQ ✅

| Fichier | Statut | Description |
|---------|--------|-------------|
| `event/SearchCompletedEvent.java` | ✅ | Modèle événement |
| `event/SearchEventPublisher.java` | ✅ | Publication events |
| `config/RabbitMQConfig.java` | ✅ | Exchanges et queues |

### Étape 8 : Configuration Sécurité ✅

| Fichier | Statut | Description |
|---------|--------|-------------|
| `config/SecurityConfig.java` | ✅ | OAuth2 Resource Server |

### Étape 9 : Dockerfile ✅

| Fichier | Statut | Description |
|---------|--------|-------------|
| `Dockerfile` | ✅ | Image Docker multi-stage |
| `.dockerignore` | ✅ | Exclusions |

---

## Phase 3 : Intégration & Tests ✅

### Étape 10 : Modifications Backend (monolithe)

| Tâche | Statut | Description |
|-------|--------|-------------|
| Endpoint `/internal/quota-check` | ✅ | `InternalController.java` créé |
| Consumer RabbitMQ | ✅ | `SearchEventConsumer.java` écoute `search.completed` |
| RabbitMQ Config | ✅ | `RabbitMQConfig.java` ajoutée |
| Dépendance AMQP | ✅ | `spring-boot-starter-amqp` dans pom.xml |
| Supprimer `codesearch` | ⏳ | Après validation complète |

**Fichiers créés dans le backend :**
```
tarif-cloak-prod/backend/src/main/java/com/muhend/backend/internal/
├── controller/
│   └── InternalController.java      ✅
├── dto/
│   └── QuotaCheckResponse.java      ✅
├── event/
│   ├── SearchCompletedEvent.java    ✅
│   └── SearchEventConsumer.java     ✅
└── config/
    └── RabbitMQConfig.java          ✅
```

### Étape 11 : Docker Compose

| Fichier | Statut | Description |
|---------|--------|-------------|
| `docker-compose.yml` | ✅ | search-service, RabbitMQ, Redis configurés |
| `docker-compose.dev.yml` | ⏳ | Override développement (optionnel) |

**Services configurés :**
```yaml
services:
  search-service:    ✅ CRÉÉ (scalable avec replicas)
  rabbitmq:          ✅ CRÉÉ (3.12-management-alpine)
  redis:             ✅ CRÉÉ (7-alpine)
  backend:           EXISTANT (à intégrer)
  frontend:          EXISTANT
  postgres:          EXISTANT
  keycloak:          EXISTANT
  traefik:           EXISTANT (routing configuré via labels)
```

### Étape 12 : Configuration Traefik

| Tâche | Statut | Description |
|-------|--------|-------------|
| Route `/api/recherche` → search-service | ✅ | Labels Traefik dans docker-compose.yml |
| Middleware strip `/api` | ✅ | Configuré |
| Route `/` → backend | ⏳ | Existant (à vérifier) |

### Étape 13 : Intégration docker-compose monolithe

| Tâche | Statut | Description |
|-------|--------|-------------|
| Config application.yml backend | ✅ | Config RabbitMQ ajoutée |
| docker-compose-prod.yml | ✅ | Services RabbitMQ, Redis, search-service ajoutés |
| Variables .env | ✅ | RABBITMQ_*, SEARCH_SERVICE_* ajoutées |
| Labels Traefik search-service | ✅ | Route `/api/recherche` → search-service (priorité 20) |

### Étape 14 : Tests (Phase 4)

| Type | Statut | Description |
|------|--------|-------------|
| Tests compilation | ⏳ | `mvn clean compile` (JAVA_HOME requis) |
| Tests intégration | ⏳ | Communication inter-services |
| Tests de charge | ⏳ | Validation scaling |

---

## Phase 4 : Bascule Production ⏳

### Étape 14 : Déploiement

| Tâche | Statut | Description |
|-------|--------|-------------|
| Build images Docker | ⏳ | CI/CD |
| Déploiement staging | ⏳ | Environnement de test |
| Tests de validation | ⏳ | Smoke tests |
| Bascule production | ⏳ | Blue-green deployment |

### Étape 15 : Monitoring

| Tâche | Statut | Description |
|-------|--------|-------------|
| Health checks | ⏳ | Actuator endpoints |
| Alertes | ⏳ | Seuils critiques |
| Dashboards | ⏳ | Grafana (optionnel) |

---

## Checklist de Migration

### Avant bascule

- [ ] Tous les endpoints `/recherche/*` fonctionnent
- [ ] Communication Feign avec backend OK
- [ ] Événements RabbitMQ publiés et consommés
- [ ] Cache Redis opérationnel
- [ ] Circuit breaker testé
- [ ] Authentification JWT validée
- [ ] Tests de charge passés
- [ ] Rollback plan documenté

### Après bascule

- [ ] Monitoring actif
- [ ] Logs centralisés
- [ ] Supprimer code `codesearch` du monolithe
- [ ] Documentation mise à jour

---

## Rollback

En cas de problème :

1. **Traefik** : Rediriger `/recherche` vers le backend
2. **Docker** : `docker-compose stop search-service`
3. Le monolithe reprend le traitement des recherches

**Temps estimé de rollback** : < 5 minutes
