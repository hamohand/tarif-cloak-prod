# Architecture Micro-services - Tarif SaaS

## Vue d'ensemble

### Approche Choisie : Monolithe + Service Extrait

Plutôt qu'une migration complète vers les micro-services, nous avons opté pour une **approche hybride** :

- **Monolithe conservé** : Organisation, Billing, Auth, Admin, Usage
- **Service extrait** : Search (le seul avec des besoins de scaling)

### Justification

| Critère | Micro-services complets | Approche hybride |
|---------|------------------------|------------------|
| Complexité opérationnelle | Élevée (8-10 services) | Faible (2 services) |
| Compétences K8s requises | Avancées | Basiques |
| Temps de migration | 3-6 mois | 2-4 semaines |
| Bénéfice scaling | ✅ | ✅ (là où nécessaire) |
| Risque | Élevé | Faible |

---

## Composants

### 1. Search Service (nouveau)

**Responsabilités :**
- Recherche HS codes avec IA (OpenAI, Anthropic, Ollama)
- Génération du contexte RAG
- Cache des résultats fréquents

**Endpoints :**
```
GET /recherche/sections?termeRecherche=<term>
GET /recherche/chapitres?termeRecherche=<term>
GET /recherche/positions4?termeRecherche=<term>
GET /recherche/positions6?termeRecherche=<term>
```

**Technologies :**
- Spring Boot 3.5.6
- Java 21
- Spring Data JPA
- OpenFeign (communication avec backend)
- RabbitMQ (événements)
- Redis (cache)

**Scaling :**
```bash
docker-compose up -d --scale search-service=4
```

### 2. Backend (monolithe allégé)

**Responsabilités conservées :**
- Gestion des organisations et utilisateurs
- Facturation et plans tarifaires
- Authentification (intégration Keycloak)
- Administration
- Logging d'usage (consommateur d'événements)

**Nouveau endpoint exposé :**
```
GET /internal/quota-check?userId=<id>
```

### 3. Infrastructure

| Composant | Rôle | Port |
|-----------|------|------|
| Traefik | Reverse proxy, routing, SSL | 80/443 |
| PostgreSQL | Base de données partagée | 5432 |
| Redis | Cache pour search-service | 6379 |
| RabbitMQ | Message broker | 5672/15672 |
| Keycloak | Authentification OAuth2/OIDC | 8080 |

---

## Communication Inter-services

### Synchrone (REST/Feign)

```
Search Service ──────► Backend
                       │
    Avant chaque       │  GET /internal/quota-check
    recherche          │
                       │  Response: { canSearch: true, quotaRemaining: 42 }
```

### Asynchrone (RabbitMQ)

```
Search Service                          Backend
      │                                    │
      │  ┌──────────────────────────┐      │
      ├─►│  Exchange: search        │──────┤
      │  │  Queue: search.completed │      │
      │  └──────────────────────────┘      │
      │                                    ▼
      │                              UsageLogService
      │                              (log l'usage)
```

**Format de l'événement `search.completed` :**
```json
{
  "eventId": "uuid",
  "timestamp": "2024-01-15T10:30:00Z",
  "userId": "keycloak-user-id",
  "organizationId": 123,
  "endpoint": "/recherche/positions6",
  "searchTerm": "drone caméra",
  "tokensUsed": 450,
  "costUsd": 0.002,
  "success": true
}
```

---

## Sécurité

### Authentification

Les deux services utilisent le même Keycloak :

```yaml
# search-service/application.yml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: ${KEYCLOAK_ISSUER_URI}
          jwk-set-uri: ${KEYCLOAK_JWK_SET_URI}
```

### Communication interne

- Le search-service transmet le JWT à ses appels vers le backend
- Configuration Feign avec `RequestInterceptor` pour propager l'authentification

---

## Base de Données

### Stratégie : Base Partagée

Pour cette première phase, les deux services partagent la même base PostgreSQL.

**Accès du search-service :**
- Lecture seule sur : `section`, `chapitre`, `position4`, `position6_dz`
- Pas d'écriture directe (l'usage est logué via événement)

**Évolution future possible :**
- Séparer les tables HS codes dans une base dédiée
- Répliquer les données avec CDC (Change Data Capture)

---

## Routing Traefik

```yaml
# Configuration Traefik
http:
  routers:
    search-router:
      rule: "PathPrefix(`/recherche`)"
      service: search-service
      priority: 10

    backend-router:
      rule: "PathPrefix(`/`)"
      service: backend
      priority: 1  # Catch-all

  services:
    search-service:
      loadBalancer:
        servers:
          - url: "http://search-service:8082"

    backend:
      loadBalancer:
        servers:
          - url: "http://backend:8081"
```

---

## Résilience

### Circuit Breaker (Resilience4j)

Le search-service utilise un circuit breaker pour les appels au backend :

```yaml
resilience4j:
  circuitbreaker:
    instances:
      backendService:
        slidingWindowSize: 10
        failureRateThreshold: 50
        waitDurationInOpenState: 10s
```

### Comportement en cas de panne du backend

1. **Circuit fermé** : Appels normaux
2. **Circuit ouvert** : Fallback → autoriser la recherche sans vérification quota (mode dégradé)
3. **Circuit semi-ouvert** : Tentatives de reconnexion

---

## Observabilité

### Health Checks

```
GET /actuator/health          # État général
GET /actuator/health/liveness # Pour K8s
GET /actuator/health/readiness
```

### Métriques (Actuator)

```
GET /actuator/metrics/http.server.requests
GET /actuator/metrics/jvm.memory.used
```

### Logs

Format JSON recommandé pour agrégation (ELK) :

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "service": "search-service",
  "traceId": "abc123",
  "message": "Search completed",
  "searchTerm": "drone",
  "tokensUsed": 450
}
```
