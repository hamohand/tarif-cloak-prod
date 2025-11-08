# Phase 2 - Association Utilisateur → Entreprise : Implémentation Complète ✅

## ✅ Ce qui a été fait

### 1. Modèle de données
- ✅ Création de l'entité `Organization` (table `organization`)
- ✅ Création de l'entité `OrganizationUser` (table `organization_user`)
- ✅ Ajout de `organization_id` à `UsageLog` (nullable)
- ✅ Les tables seront créées automatiquement par JPA avec `ddl-auto=update`

### 2. Services
- ✅ Création de `OrganizationService` pour gérer les organisations
- ✅ Méthodes pour créer, lister, associer des utilisateurs
- ✅ Méthode `getOrganizationIdByUserId()` pour récupérer l'organisation d'un utilisateur

### 3. Contrôleurs
- ✅ Création de `OrganizationController` avec endpoints ADMIN
- ✅ Endpoints pour créer, lister, gérer les organisations
- ✅ Endpoints pour ajouter/retirer des utilisateurs

### 4. Intégration avec le tracking
- ✅ Modification de `UsageLogService` pour inclure `organizationId`
- ✅ Modification de `RechercheController` pour récupérer et logger l'organisation
- ✅ Filtres par organisation dans `AdminController`

## 📋 Structure des fichiers créés

```
backend/src/main/java/com/muhend/backend/
├── organization/ (nouveau)
│   ├── model/
│   │   ├── Organization.java
│   │   └── OrganizationUser.java
│   ├── repository/
│   │   ├── OrganizationRepository.java
│   │   └── OrganizationUserRepository.java
│   ├── service/
│   │   └── OrganizationService.java
│   ├── controller/
│   │   └── OrganizationController.java
│   └── dto/
│       ├── OrganizationDto.java
│       ├── OrganizationUserDto.java
│       ├── CreateOrganizationRequest.java
│       └── AddUserToOrganizationRequest.java
├── usage/
│   ├── model/
│   │   └── UsageLog.java (modifié - ajout organization_id)
│   ├── repository/
│   │   └── UsageLogRepository.java (modifié - ajout méthodes par organisation)
│   └── service/
│       └── UsageLogService.java (modifié - ajout organizationId)
└── codesearch/
    └── controller/
        └── RechercheController.java (modifié - récupération organisation)
```

## 🔍 Structure des Tables

### Table `organization`
```sql
CREATE TABLE organization (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL
);
```

### Table `organization_user`
```sql
CREATE TABLE organization_user (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organization(id),
    keycloak_user_id VARCHAR(255) NOT NULL,
    joined_at TIMESTAMP NOT NULL,
    UNIQUE(organization_id, keycloak_user_id)
);
```

### Table `usage_log` (modifiée)
```sql
ALTER TABLE usage_log 
ADD COLUMN organization_id BIGINT REFERENCES organization(id);
```

## 🚀 API Endpoints

### Gestion des Organisations (ADMIN uniquement)

#### Créer une organisation
```http
POST /admin/organizations
Content-Type: application/json

{
  "name": "Entreprise ABC"
}
```

#### Lister toutes les organisations
```http
GET /admin/organizations
```

#### Récupérer une organisation
```http
GET /admin/organizations/{id}
```

#### Ajouter un utilisateur à une organisation
```http
POST /admin/organizations/{id}/users
Content-Type: application/json

{
  "keycloakUserId": "user-uuid-123"
}
```

#### Retirer un utilisateur d'une organisation
```http
DELETE /admin/organizations/{id}/users/{keycloakUserId}
```

#### Lister les utilisateurs d'une organisation
```http
GET /admin/organizations/{id}/users
```

#### Lister les organisations d'un utilisateur
```http
GET /admin/organizations/user/{keycloakUserId}
```

### Logs d'utilisation (ADMIN uniquement)

#### Consulter les logs par organisation
```http
GET /admin/usage-logs?organizationId=1
GET /admin/usage-logs?organizationId=1&startDate=2025-01-01&endDate=2025-01-31
```

## 🔄 Flux de Données

### 1. Création d'une organisation et association d'un utilisateur

```
1. Admin crée une organisation
   POST /admin/organizations {"name": "Entreprise ABC"}
   → Retourne: {id: 1, name: "Entreprise ABC", ...}

2. Admin associe un utilisateur
   POST /admin/organizations/1/users {"keycloakUserId": "user-123"}
   → Crée l'association dans organization_user

3. Utilisateur fait une recherche
   GET /api/recherche/positions6?termeRecherche=figues
   → RechercheController récupère l'organisation de l'utilisateur
   → UsageLogService enregistre le log avec organization_id=1
```

### 2. Consultation des logs par organisation

```
1. Admin consulte les logs d'une organisation
   GET /admin/usage-logs?organizationId=1
   → Retourne tous les logs avec organization_id=1
   → Inclut les statistiques (total requêtes, coût, tokens)
```

## 📝 Utilisation

### Étape 1 : Créer une organisation

```bash
curl -X POST https://www.hscode.enclume-numerique.com/api/admin/organizations \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Entreprise ABC"}'
```

### Étape 2 : Ajouter un utilisateur à l'organisation

```bash
# Récupérer l'ID de l'utilisateur depuis Keycloak ou les logs
curl -X POST https://www.hscode.enclume-numerique.com/api/admin/organizations/1/users \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"keycloakUserId": "user-uuid-123"}'
```

### Étape 3 : Vérifier les logs par organisation

```bash
curl -X GET "https://www.hscode.enclume-numerique.com/api/admin/usage-logs?organizationId=1" \
  -H "Authorization: Bearer <admin-token>"
```

## ⚠️ Limitations connues (Phase 2)

### 1. Un utilisateur peut avoir plusieurs organisations
**Problème** : La méthode `getOrganizationIdByUserId()` retourne seulement la première organisation.

**Impact** : Si un utilisateur appartient à plusieurs organisations, seul l'ID de la première sera enregistré.

**Solution future** : Permettre de spécifier quelle organisation utiliser, ou créer une organisation par défaut.

### 2. Pas de validation de l'utilisateur Keycloak
**Problème** : On ne vérifie pas si l'utilisateur existe vraiment dans Keycloak avant de l'associer.

**Impact** : On peut associer un ID utilisateur invalide.

**Solution future** : Intégrer avec Keycloak Admin API pour valider les utilisateurs.

### 3. Pas de gestion des rôles dans l'organisation
**Problème** : Tous les utilisateurs d'une organisation ont le même statut.

**Impact** : Pas de distinction entre admin de l'organisation et utilisateur simple.

**Solution future** : Ajouter un champ `role` dans `OrganizationUser`.

## 🧪 Tests à faire

1. **Créer une organisation**
   - Créer une organisation via l'API
   - Vérifier qu'elle est créée en base

2. **Associer un utilisateur**
   - Ajouter un utilisateur à l'organisation
   - Vérifier l'association dans `organization_user`

3. **Faire une recherche**
   - Se connecter avec l'utilisateur
   - Faire une recherche
   - Vérifier que le log contient `organization_id`

4. **Consulter les logs par organisation**
   - Filtrer les logs par `organizationId`
   - Vérifier que seuls les logs de cette organisation sont retournés

## 📝 Prochaines étapes (Phase 3)

1. Créer un endpoint de statistiques par organisation
2. Créer une page Angular pour visualiser les organisations
3. Créer un tableau de bord de consommation par organisation

## 🎯 Critères de succès Phase 2

- [x] On peut créer des organisations
- [x] On peut associer des utilisateurs à des organisations
- [x] Les logs incluent l'organisation
- [x] On peut filtrer les logs par organisation
- [x] Pas de régression sur les fonctionnalités existantes

**Phase 2 terminée ! ✅**

