# Documentation des Phases MVP - Système de Facturation

Ce document décrit l'état d'implémentation de chaque phase du MVP de facturation.

---

## 📋 Phase 1 : Tracking Basique ✅ TERMINÉE

### Objectif
Enregistrer chaque recherche avec les informations de base : utilisateur, endpoint, terme de recherche, tokens utilisés, et coût.

### Implémentation

#### Entités Créées
- **`UsageLog`** (`backend/src/main/java/com/muhend/backend/usage/model/UsageLog.java`)
  - `id` : Identifiant unique
  - `keycloakUserId` : ID de l'utilisateur Keycloak
  - `organizationId` : ID de l'organisation (nullable, ajouté en Phase 2)
  - `endpoint` : Endpoint appelé (ex: "/recherche/sections")
  - `searchTerm` : Terme de recherche
  - `tokensUsed` : Nombre de tokens OpenAI utilisés
  - `costUsd` : Coût en USD (type `BigDecimal` pour précision)
  - `timestamp` : Date et heure de la recherche

#### Services Créés
- **`UsageLogService`** (`backend/src/main/java/com/muhend/backend/usage/service/UsageLogService.java`)
  - `logUsage()` : Enregistre un log d'utilisation (non bloquant)
  - Méthodes de récupération des logs par utilisateur, organisation, période

#### Repository
- **`UsageLogRepository`** (`backend/src/main/java/com/muhend/backend/usage/repository/UsageLogRepository.java`)
  - Méthodes de recherche par utilisateur, organisation, période
  - Comptage des requêtes par organisation et période

#### Intégration
- **`RechercheController`** : Logging automatique après chaque recherche
- **`OpenAiService`** : Exposition du coût via `ThreadLocal` pour récupération dans le controller
- **`AdminController`** : Endpoint `/admin/usage-logs` pour consulter les logs (ADMIN uniquement)

### Endpoints Disponibles

#### GET `/admin/usage-logs`
- **Description** : Consulter les logs d'utilisation
- **Autorisation** : ADMIN
- **Paramètres** :
  - `userId` (optionnel) : Filtrer par utilisateur
  - `organizationId` (optionnel) : Filtrer par organisation
  - `startDate` (optionnel) : Date de début (format: yyyy-MM-dd)
  - `endDate` (optionnel) : Date de fin (format: yyyy-MM-dd)
- **Réponse** : Liste des logs avec statistiques (total, coût total, tokens totaux)

### Base de Données

#### Table `usage_log`
```sql
CREATE TABLE usage_log (
    id BIGSERIAL PRIMARY KEY,
    keycloak_user_id VARCHAR(255),
    organization_id BIGINT REFERENCES organization(id),
    endpoint VARCHAR(255),
    search_term VARCHAR(500),
    tokens_used INTEGER,
    cost_usd DECIMAL(10, 6),
    timestamp TIMESTAMP DEFAULT NOW()
);
```

### Caractéristiques
- ✅ Logging non bloquant (ne fait jamais échouer la requête principale)
- ✅ Gestion des erreurs (si la table n'existe pas, warning dans les logs)
- ✅ Précision monétaire (utilisation de `BigDecimal` pour les coûts)
- ✅ Timestamp automatique

### Exemples d'Utilisation

#### Consulter tous les logs
```bash
curl -X GET "https://www.hscode.enclume-numerique.com/api/admin/usage-logs" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

#### Consulter les logs d'un utilisateur
```bash
curl -X GET "https://www.hscode.enclume-numerique.com/api/admin/usage-logs?userId=USER_ID" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

#### Consulter les logs d'une organisation sur une période
```bash
curl -X GET "https://www.hscode.enclume-numerique.com/api/admin/usage-logs?organizationId=1&startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## 📋 Phase 2 : Association Utilisateur → Entreprise ✅ TERMINÉE

### Objectif
Associer les utilisateurs à des entreprises pour permettre le suivi des coûts par organisation.

### Implémentation

#### Entités Créées
- **`Organization`** (`backend/src/main/java/com/muhend/backend/organization/model/Organization.java`)
  - `id` : Identifiant unique
  - `name` : Nom de l'organisation
  - `monthlyQuota` : Quota mensuel (nullable, ajouté en Phase 4)
  - `createdAt` : Date de création

- **`OrganizationUser`** (`backend/src/main/java/com/muhend/backend/organization/model/OrganizationUser.java`)
  - `id` : Identifiant unique
  - `organization` : Référence à l'organisation
  - `keycloakUserId` : ID de l'utilisateur Keycloak
  - `joinedAt` : Date d'ajout à l'organisation

#### Services Créés
- **`OrganizationService`** (`backend/src/main/java/com/muhend/backend/organization/service/OrganizationService.java`)
  - `createOrganization()` : Créer une organisation
  - `getAllOrganizations()` : Récupérer toutes les organisations
  - `getOrganizationById()` : Récupérer une organisation par ID
  - `addUserToOrganization()` : Associer un utilisateur à une organisation
  - `removeUserFromOrganization()` : Retirer un utilisateur d'une organisation
  - `getOrganizationsByUser()` : Récupérer les organisations d'un utilisateur
  - `getUsersByOrganization()` : Récupérer les utilisateurs d'une organisation
  - `getOrganizationIdByUserId()` : Récupérer l'ID de l'organisation d'un utilisateur
  - `checkQuota()` : Vérifier le quota (Phase 4)
  - `updateMonthlyQuota()` : Mettre à jour le quota (Phase 4)

#### Repository
- **`OrganizationRepository`** : Repository JPA pour `Organization`
- **`OrganizationUserRepository`** : Repository JPA pour `OrganizationUser`

#### Intégration
- **`RechercheController`** : Récupération de l'organisation de l'utilisateur pour le logging
- **`UsageLog`** : Ajout du champ `organizationId` (nullable)
- **`OrganizationController`** : Endpoints REST pour gérer les organisations

### Endpoints Disponibles

#### POST `/admin/organizations`
- **Description** : Créer une organisation
- **Autorisation** : ADMIN
- **Body** :
  ```json
  {
    "name": "Nom de l'organisation"
  }
  ```
- **Réponse** : Organisation créée avec ID

#### GET `/admin/organizations`
- **Description** : Lister toutes les organisations
- **Autorisation** : ADMIN
- **Réponse** : Liste des organisations avec nombre d'utilisateurs

#### GET `/admin/organizations/{id}`
- **Description** : Récupérer une organisation
- **Autorisation** : ADMIN
- **Réponse** : Détails de l'organisation

#### POST `/admin/organizations/{id}/users`
- **Description** : Ajouter un utilisateur à une organisation
- **Autorisation** : ADMIN
- **Body** :
  ```json
  {
    "keycloakUserId": "USER_KEYCLOAK_ID"
  }
  ```
- **Réponse** : Utilisateur ajouté

#### DELETE `/admin/organizations/{id}/users/{keycloakUserId}`
- **Description** : Retirer un utilisateur d'une organisation
- **Autorisation** : ADMIN
- **Réponse** : Message de succès

#### GET `/admin/organizations/{id}/users`
- **Description** : Lister les utilisateurs d'une organisation
- **Autorisation** : ADMIN
- **Réponse** : Liste des utilisateurs

#### GET `/admin/organizations/user/{keycloakUserId}`
- **Description** : Lister les organisations d'un utilisateur
- **Autorisation** : ADMIN
- **Réponse** : Liste des organisations

#### PUT `/admin/organizations/{id}/quota`
- **Description** : Mettre à jour le quota mensuel (Phase 4)
- **Autorisation** : ADMIN
- **Body** :
  ```json
  {
    "monthlyQuota": 100
  }
  ```
- **Réponse** : Organisation mise à jour

### Base de Données

#### Table `organization`
```sql
CREATE TABLE organization (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    monthly_quota INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Table `organization_user`
```sql
CREATE TABLE organization_user (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT REFERENCES organization(id),
    keycloak_user_id VARCHAR(255) NOT NULL,
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(organization_id, keycloak_user_id)
);
```

### Caractéristiques
- ✅ Association multiple (un utilisateur peut être dans plusieurs organisations)
- ✅ Contraintes d'unicité (un utilisateur ne peut pas être ajouté deux fois à la même organisation)
- ✅ Récupération automatique de l'organisation dans le logging
- ✅ Support des utilisateurs sans organisation (organizationId = null)

### Exemples d'Utilisation

#### Créer une organisation
```bash
curl -X POST "https://www.hscode.enclume-numerique.com/api/admin/organizations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "name": "Entreprise ABC"
  }'
```

#### Ajouter un utilisateur à une organisation
```bash
curl -X POST "https://www.hscode.enclume-numerique.com/api/admin/organizations/1/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "keycloakUserId": "user-keycloak-id"
  }'
```

---

## 📋 Phase 3 : Visualisation Simple ✅ TERMINÉE

### Objectif
Créer une page simple pour visualiser les statistiques d'utilisation par entreprise et par utilisateur.

### Implémentation

#### Backend
- **`AdminController.getUsageStats()`** : Endpoint pour récupérer les statistiques agrégées
  - Statistiques globales (total requêtes, coût total, tokens totaux)
  - Statistiques par organisation
  - Statistiques par utilisateur
  - Utilisations récentes (10 dernières)

#### Frontend
- **`StatsComponent`** (`frontend/src/app/features/admin/stats/stats.component.ts`)
  - Affichage des statistiques par organisation
  - Affichage des statistiques par utilisateur
  - Affichage des utilisations récentes
  - Filtrage par organisation
  - Filtrage par période (début/fin)

#### Navigation
- **`NavbarComponent`** : Ajout d'un bouton "Stats" visible uniquement pour les ADMIN
- **`AuthService.hasRole()`** : Méthode pour vérifier les rôles utilisateur

### Endpoints Disponibles

#### GET `/admin/usage/stats`
- **Description** : Obtenir les statistiques d'utilisation
- **Autorisation** : ADMIN
- **Paramètres** :
  - `organizationId` (optionnel) : Filtrer par organisation
  - `startDate` (optionnel) : Date de début (format: yyyy-MM-dd)
  - `endDate` (optionnel) : Date de fin (format: yyyy-MM-dd)
- **Réponse** :
  ```json
  {
    "totalRequests": 150,
    "totalCostUsd": 12.50,
    "totalTokens": 50000,
    "statsByOrganization": [
      {
        "organizationId": 1,
        "organizationName": "Entreprise ABC",
        "requestCount": 100,
        "totalCostUsd": 8.50,
        "totalTokens": 35000
      }
    ],
    "statsByUser": [
      {
        "keycloakUserId": "user-id",
        "requestCount": 50,
        "totalCostUsd": 4.00,
        "totalTokens": 15000
      }
    ],
    "recentUsage": [...]
  }
  ```

### Interface Utilisateur
- Page `/admin/stats` accessible uniquement aux ADMIN
- Cartes de statistiques avec :
  - Nombre total de requêtes
  - Coût total
  - Tokens totaux
- Tableaux pour :
  - Statistiques par organisation
  - Statistiques par utilisateur
  - Utilisations récentes
- Filtres :
  - Sélection d'organisation
  - Sélection de période

### Caractéristiques
- ✅ Agrégation des statistiques en temps réel
- ✅ Filtrage par organisation et période
- ✅ Affichage des 10 dernières utilisations
- ✅ Interface responsive
- ✅ Accès restreint aux ADMIN

### Exemples d'Utilisation

#### Récupérer toutes les statistiques
```bash
curl -X GET "https://www.hscode.enclume-numerique.com/api/admin/usage/stats" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

#### Récupérer les statistiques d'une organisation
```bash
curl -X GET "https://www.hscode.enclume-numerique.com/api/admin/usage/stats?organizationId=1" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

#### Récupérer les statistiques sur une période
```bash
curl -X GET "https://www.hscode.enclume-numerique.com/api/admin/usage/stats?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## 📋 Phase 4 : Quotas Basiques ✅ TERMINÉE

### Objectif
Ajouter une limite simple de requêtes par mois par entreprise.

### Implémentation

#### Modifications des Entités
- **`Organization`** : Ajout du champ `monthlyQuota` (Integer, nullable)
  - `null` = quota illimité
  - Nombre entier = limite de requêtes par mois

#### Exception
- **`QuotaExceededException`** (`backend/src/main/java/com/muhend/backend/organization/exception/QuotaExceededException.java`)
  - Exception levée lorsque le quota mensuel est dépassé

#### Services
- **`OrganizationService.checkQuota()`** : Vérifie le quota mensuel
  - Compte les requêtes du mois en cours
  - Compare avec le quota défini
  - Lève `QuotaExceededException` si dépassé
  - Autorise si quota null (illimité)
  - Autorise si organisation introuvable (non bloquant)

- **`OrganizationService.updateMonthlyQuota()`** : Met à jour le quota mensuel

#### Gestionnaire d'Exceptions
- **`GlobalExceptionHandler`** (`backend/src/main/java/com/muhend/backend/exception/GlobalExceptionHandler.java`)
  - Gère `QuotaExceededException`
  - Renvoie HTTP 429 (Too Many Requests) avec message d'erreur

#### Intégration
- **`RechercheController`** : Vérification du quota avant chaque recherche
  - Tous les endpoints de recherche vérifient le quota
  - Si quota dépassé, la recherche n'est pas effectuée
  - Le logging n'est pas effectué si le quota est dépassé

#### Endpoints
- **`PUT /admin/organizations/{id}/quota`** : Mettre à jour le quota

### Endpoints Disponibles

#### PUT `/admin/organizations/{id}/quota`
- **Description** : Mettre à jour le quota mensuel d'une organisation
- **Autorisation** : ADMIN
- **Body** :
  ```json
  {
    "monthlyQuota": 100
  }
  ```
  ou pour quota illimité :
  ```json
  {
    "monthlyQuota": null
  }
  ```
- **Réponse** : Organisation mise à jour

### Base de Données

#### Modification de la table `organization`
```sql
ALTER TABLE organization 
ADD COLUMN monthly_quota INTEGER;
```

### Caractéristiques
- ✅ Quota mensuel : comptage basé sur le mois en cours (du 1er au dernier jour)
- ✅ Quota illimité : si `monthlyQuota` est `null`, aucune vérification
- ✅ Blocage automatique : si le quota est dépassé, HTTP 429 est renvoyé
- ✅ Gestion non bloquante : si l'organisation est introuvable, la recherche est autorisée
- ✅ Pas de logging si quota dépassé : les recherches non effectuées ne sont pas loggées

### Comportement

#### Quota Non Dépassé
- La recherche est effectuée normalement
- Le log d'utilisation est enregistré
- Réponse HTTP 200 avec les résultats

#### Quota Dépassé
- La recherche n'est pas effectuée
- Le log d'utilisation n'est pas enregistré
- Réponse HTTP 429 avec message d'erreur :
  ```json
  {
    "error": "QUOTA_EXCEEDED",
    "message": "Quota mensuel dépassé pour l'organisation 'Nom' (ID: 1). Utilisation: 100/50 requêtes",
    "status": 429
  }
  ```

#### Quota Illimité (null)
- La recherche est effectuée normalement
- Le log d'utilisation est enregistré
- Aucune vérification de quota

#### Utilisateur Sans Organisation
- La recherche est effectuée normalement
- Le log d'utilisation est enregistré (organizationId = null)
- Aucune vérification de quota

### Exemples d'Utilisation

#### Définir un quota de 100 requêtes/mois
```bash
curl -X PUT "https://www.hscode.enclume-numerique.com/api/admin/organizations/1/quota" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "monthlyQuota": 100
  }'
```

#### Mettre le quota à illimité
```bash
curl -X PUT "https://www.hscode.enclume-numerique.com/api/admin/organizations/1/quota" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "monthlyQuota": null
  }'
```

#### Tentative de recherche avec quota dépassé
```bash
curl -X GET "https://www.hscode.enclume-numerique.com/api/recherche/positions6?termeRecherche=test" \
  -H "Authorization: Bearer USER_TOKEN"

# Réponse: HTTP 429
# {
#   "error": "QUOTA_EXCEEDED",
#   "message": "Quota mensuel dépassé pour l'organisation 'Nom' (ID: 1). Utilisation: 100/50 requêtes",
#   "status": 429
# }
```

### Tests

#### Tests Unitaires
- `OrganizationServiceTest` : Tests pour `checkQuota()` et `updateMonthlyQuota()`
- `QuotaExceededExceptionTest` : Tests pour l'exception

#### Tests d'Intégration
- Scripts de test manuels : `test-quota.sh` et `test-quota-windows.ps1`
- Documentation : `TESTS_QUOTA.md` et `RESUME_TESTS_QUOTA.md`

---

## 📊 État Global des Phases

| Phase | Statut | Description | Date de Complétion |
|-------|--------|-------------|-------------------|
| Phase 1 | ✅ Terminée | Tracking Basique | Implémentée |
| Phase 2 | ✅ Terminée | Association Utilisateur → Entreprise | Implémentée |
| Phase 3 | ✅ Terminée | Visualisation Simple | Implémentée |
| Phase 4 | ✅ Terminée | Quotas Basiques | Implémentée |

## 🔄 Prochaines Phases (Non Implémentées)

### Phase 5 : Plans Tarifaires (Future)
- Création de plans tarifaires (Starter, Professional, Enterprise)
- Association des plans aux organisations
- Calcul automatique des coûts selon le plan

### Phase 6 : Facturation (Future)
- Génération de factures mensuelles
- Export PDF des factures
- Historique des factures

### Phase 7 : Paiements (Future)
- Intégration de système de paiement
- Gestion des abonnements
- Notifications de paiement

---

## 📝 Notes Importantes

### Sécurité
- Tous les endpoints d'administration nécessitent le rôle ADMIN
- Les endpoints de recherche nécessitent le rôle USER ou ADMIN
- Les tokens JWT sont validés à chaque requête

### Performance
- Le logging est non bloquant (ne ralentit pas les recherches)
- La vérification du quota est rapide (simple comptage en base)
- Les statistiques sont calculées à la volée (pas de cache pour l'instant)

### Limitations Actuelles
- Un utilisateur peut être dans plusieurs organisations, mais seule la première est utilisée pour le quota
- Le quota est réinitialisé au début de chaque mois (basé sur la date système)
- Pas de notification automatique lorsque le quota est proche d'être dépassé
- Pas de gestion des plans tarifaires (quota fixe par organisation)

### Améliorations Futures
- Support multi-organisations pour un utilisateur (choix de l'organisation)
- Notifications de quota proche
- Cache des statistiques pour améliorer les performances
- Export des statistiques en CSV/Excel
- Dashboard en temps réel avec WebSockets

---

## 📚 Ressources

### Documentation
- `PLAN_MVP_FACTURATION.md` : Plan initial du MVP
- `STRATEGIE_FACTURATION.md` : Stratégie complète de facturation
- `TESTS_QUOTA.md` : Documentation des tests de quota
- `RESUME_TESTS_QUOTA.md` : Résumé des tests

### Fichiers de Test
- `test-quota.sh` : Script de test bash
- `test-quota-windows.ps1` : Script de test PowerShell
- `backend/src/test/java/com/muhend/backend/organization/service/OrganizationServiceTest.java` : Tests unitaires

### Endpoints API
- Swagger UI : `https://www.hscode.enclume-numerique.com/swagger-ui.html`
- API Docs : `https://www.hscode.enclume-numerique.com/v3/api-docs`

---

*Dernière mise à jour : Phase 4 complétée*

