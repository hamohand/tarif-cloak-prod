# Exemples d'Organisations et Associations Utilisateur-Organisation

## 📋 Exemples de Données

### Exemple 1 : Organisation Simple

#### Table `organization`
```sql
id | name              | created_at
---|-------------------|---------------------------
1  | Entreprise ABC    | 2025-01-15 10:30:00
2  | Société XYZ       | 2025-01-16 14:20:00
3  | Compagnie DEF     | 2025-01-17 09:15:00
```

#### Table `organization_user`
```sql
id | organization_id | keycloak_user_id        | joined_at
---|-----------------|-------------------------|---------------------------
1  | 1               | 123e4567-e89b-12d3...   | 2025-01-15 10:35:00
2  | 1               | 987f6543-e21b-12d3...   | 2025-01-15 11:00:00
3  | 2               | 456e7890-e12b-34d5...   | 2025-01-16 14:25:00
4  | 3               | 789a0123-e45b-67d8...   | 2025-01-17 09:20:00
```

#### Table `usage_log` (avec organization_id)
```sql
id | keycloak_user_id | organization_id | endpoint              | search_term | tokens_used | cost_usd | timestamp
---|------------------|-----------------|----------------------|-------------|-------------|----------|---------------------------
1  | 123e4567-...     | 1               | /recherche/positions6| figues      | 150         | 0.000045 | 2025-01-15 11:00:00
2  | 123e4567-...     | 1               | /recherche/sections  | voitures    | 100         | 0.000030 | 2025-01-15 11:05:00
3  | 987f6543-...     | 1               | /recherche/chapitres | fruits      | 120         | 0.000036 | 2025-01-15 11:10:00
4  | 456e7890-...     | 2               | /recherche/positions6| machines    | 200         | 0.000060 | 2025-01-16 15:00:00
5  | 789a0123-...     | 3               | /recherche/sections  | textiles    | 80          | 0.000024 | 2025-01-17 10:00:00
```

---

## 🔄 Exemples d'Utilisation de l'API

### Exemple 1 : Créer une Organisation

#### Requête
```http
POST /admin/organizations
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "Entreprise ABC"
}
```

#### Réponse
```json
{
  "id": 1,
  "name": "Entreprise ABC",
  "createdAt": "2025-01-15T10:30:00",
  "userCount": 0
}
```

---

### Exemple 2 : Ajouter un Utilisateur à une Organisation

#### Requête
```http
POST /admin/organizations/1/users
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "keycloakUserId": "123e4567-e89b-12d3-a456-426614174000"
}
```

#### Réponse
```json
{
  "id": 1,
  "organizationId": 1,
  "organizationName": "Entreprise ABC",
  "keycloakUserId": "123e4567-e89b-12d3-a456-426614174000",
  "joinedAt": "2025-01-15T10:35:00"
}
```

---

### Exemple 3 : Lister Toutes les Organisations

#### Requête
```http
GET /admin/organizations
Authorization: Bearer <admin-token>
```

#### Réponse
```json
[
  {
    "id": 1,
    "name": "Entreprise ABC",
    "createdAt": "2025-01-15T10:30:00",
    "userCount": 2
  },
  {
    "id": 2,
    "name": "Société XYZ",
    "createdAt": "2025-01-16T14:20:00",
    "userCount": 1
  },
  {
    "id": 3,
    "name": "Compagnie DEF",
    "createdAt": "2025-01-17T09:15:00",
    "userCount": 1
  }
]
```

---

### Exemple 4 : Lister les Utilisateurs d'une Organisation

#### Requête
```http
GET /admin/organizations/1/users
Authorization: Bearer <admin-token>
```

#### Réponse
```json
[
  {
    "id": 1,
    "organizationId": 1,
    "organizationName": "Entreprise ABC",
    "keycloakUserId": "123e4567-e89b-12d3-a456-426614174000",
    "joinedAt": "2025-01-15T10:35:00"
  },
  {
    "id": 2,
    "organizationId": 1,
    "organizationName": "Entreprise ABC",
    "keycloakUserId": "987f6543-e21b-12d3-a456-426614174000",
    "joinedAt": "2025-01-15T11:00:00"
  }
]
```

---

### Exemple 5 : Lister les Organisations d'un Utilisateur

#### Requête
```http
GET /admin/organizations/user/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <admin-token>
```

#### Réponse
```json
[
  {
    "id": 1,
    "name": "Entreprise ABC",
    "createdAt": "2025-01-15T10:30:00",
    "userCount": 2
  }
]
```

---

### Exemple 6 : Consulter les Logs d'une Organisation

#### Requête
```http
GET /admin/usage-logs?organizationId=1
Authorization: Bearer <admin-token>
```

#### Réponse
```json
{
  "total": 3,
  "totalCostUsd": 0.000111,
  "totalTokens": 370,
  "logs": [
    {
      "id": 1,
      "keycloakUserId": "123e4567-e89b-12d3-a456-426614174000",
      "organizationId": 1,
      "endpoint": "/recherche/positions6",
      "searchTerm": "figues",
      "tokensUsed": 150,
      "costUsd": 0.000045,
      "timestamp": "2025-01-15T11:00:00"
    },
    {
      "id": 2,
      "keycloakUserId": "123e4567-e89b-12d3-a456-426614174000",
      "organizationId": 1,
      "endpoint": "/recherche/sections",
      "searchTerm": "voitures",
      "tokensUsed": 100,
      "costUsd": 0.000030,
      "timestamp": "2025-01-15T11:05:00"
    },
    {
      "id": 3,
      "keycloakUserId": "987f6543-e21b-12d3-a456-426614174000",
      "organizationId": 1,
      "endpoint": "/recherche/chapitres",
      "searchTerm": "fruits",
      "tokensUsed": 120,
      "costUsd": 0.000036,
      "timestamp": "2025-01-15T11:10:00"
    }
  ]
}
```

---

### Exemple 7 : Consulter les Logs d'une Organisation sur une Période

#### Requête
```http
GET /admin/usage-logs?organizationId=1&startDate=2025-01-15&endDate=2025-01-31
Authorization: Bearer <admin-token>
```

#### Réponse
```json
{
  "total": 3,
  "totalCostUsd": 0.000111,
  "totalTokens": 370,
  "logs": [
    // ... tous les logs de l'organisation 1 entre le 15 et le 31 janvier
  ]
}
```

---

## 📊 Scénario Complet : Création et Utilisation

### Étape 1 : Créer une Organisation

```bash
curl -X POST https://www.hscode.enclume-numerique.com/api/admin/organizations \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation"
  }'
```

**Réponse** :
```json
{
  "id": 1,
  "name": "Acme Corporation",
  "createdAt": "2025-01-20T10:00:00",
  "userCount": 0
}
```

### Étape 2 : Ajouter des Utilisateurs

```bash
# Ajouter l'utilisateur "moh"
curl -X POST https://www.hscode.enclume-numerique.com/api/admin/organizations/1/users \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "keycloakUserId": "keycloak-user-id-moh"
  }'

# Ajouter l'utilisateur "admin"
curl -X POST https://www.hscode.enclume-numerique.com/api/admin/organizations/1/users \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "keycloakUserId": "keycloak-user-id-admin"
  }'
```

### Étape 3 : Vérifier les Utilisateurs

```bash
curl -X GET https://www.hscode.enclume-numerique.com/api/admin/organizations/1/users \
  -H "Authorization: Bearer <admin-token>"
```

**Réponse** :
```json
[
  {
    "id": 1,
    "organizationId": 1,
    "organizationName": "Acme Corporation",
    "keycloakUserId": "keycloak-user-id-moh",
    "joinedAt": "2025-01-20T10:05:00"
  },
  {
    "id": 2,
    "organizationId": 1,
    "organizationName": "Acme Corporation",
    "keycloakUserId": "keycloak-user-id-admin",
    "joinedAt": "2025-01-20T10:10:00"
  }
]
```

### Étape 4 : Faire des Recherches (en tant qu'utilisateur)

Quand l'utilisateur "moh" fait une recherche :
- Le système récupère automatiquement son `organization_id` (1)
- Le log est enregistré avec `organization_id = 1`

### Étape 5 : Consulter les Logs de l'Organisation

```bash
curl -X GET "https://www.hscode.enclume-numerique.com/api/admin/usage-logs?organizationId=1" \
  -H "Authorization: Bearer <admin-token>"
```

**Réponse** :
```json
{
  "total": 5,
  "totalCostUsd": 0.000185,
  "totalTokens": 620,
  "logs": [
    {
      "id": 1,
      "keycloakUserId": "keycloak-user-id-moh",
      "organizationId": 1,
      "endpoint": "/recherche/positions6",
      "searchTerm": "figues",
      "tokensUsed": 150,
      "costUsd": 0.000045,
      "timestamp": "2025-01-20T11:00:00"
    },
    // ... autres logs de l'organisation
  ]
}
```

---

## 🔍 Comment Récupérer l'ID Utilisateur Keycloak

Pour ajouter un utilisateur à une organisation, vous avez besoin de son `keycloakUserId` (le champ `sub` du JWT).

### Méthode 1 : Depuis le JWT Token

1. Connectez-vous avec l'utilisateur
2. Ouvrez les DevTools du navigateur
3. Dans la console, décodez le token JWT
4. Récupérez le champ `sub`

### Méthode 2 : Depuis les Logs d'Utilisation

```bash
# Lister tous les logs pour voir les keycloakUserId
curl -X GET https://www.hscode.enclume-numerique.com/api/admin/usage-logs \
  -H "Authorization: Bearer <admin-token>"
```

Les logs contiennent le `keycloakUserId` de chaque utilisateur.

### Méthode 3 : Depuis Keycloak Admin Console

1. Connectez-vous à Keycloak Admin Console
2. Allez dans Users
3. Sélectionnez un utilisateur
4. L'ID utilisateur est affiché (format UUID)

---

## 📝 Exemples de Données Réelles

### Organisation : "TechCorp"
```json
{
  "id": 1,
  "name": "TechCorp",
  "createdAt": "2025-01-15T10:30:00"
}
```

### Utilisateurs de TechCorp
```json
[
  {
    "id": 1,
    "organizationId": 1,
    "organizationName": "TechCorp",
    "keycloakUserId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "joinedAt": "2025-01-15T10:35:00"
  },
  {
    "id": 2,
    "organizationId": 1,
    "organizationName": "TechCorp",
    "keycloakUserId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "joinedAt": "2025-01-15T11:00:00"
  }
]
```

### Logs d'Utilisation de TechCorp
```json
[
  {
    "id": 1,
    "keycloakUserId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "organizationId": 1,
    "endpoint": "/recherche/positions6",
    "searchTerm": "ordinateurs portables",
    "tokensUsed": 200,
    "costUsd": 0.000060,
    "timestamp": "2025-01-15T14:30:00"
  },
  {
    "id": 2,
    "keycloakUserId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "organizationId": 1,
    "endpoint": "/recherche/sections",
    "searchTerm": "composants électroniques",
    "tokensUsed": 150,
    "costUsd": 0.000045,
    "timestamp": "2025-01-15T15:00:00"
  }
]
```

---

## 🎯 Cas d'Usage Typiques

### Cas 1 : Nouvelle Entreprise avec 3 Utilisateurs

1. **Créer l'organisation** :
   ```json
   POST /admin/organizations
   {"name": "Nouvelle Entreprise"}
   → Retourne: {id: 4, name: "Nouvelle Entreprise", ...}
   ```

2. **Ajouter les 3 utilisateurs** :
   ```json
   POST /admin/organizations/4/users
   {"keycloakUserId": "user-1-id"}
   
   POST /admin/organizations/4/users
   {"keycloakUserId": "user-2-id"}
   
   POST /admin/organizations/4/users
   {"keycloakUserId": "user-3-id"}
   ```

3. **Résultat** : Toutes les recherches de ces 3 utilisateurs seront associées à l'organisation 4.

### Cas 2 : Utilisateur Sans Organisation

Si un utilisateur n'a pas d'organisation :
- `organization_id` sera `null` dans les logs
- Les recherches fonctionnent normalement
- Les logs peuvent toujours être consultés par `keycloakUserId`

### Cas 3 : Utilisateur avec Plusieurs Organisations

**Limitation Phase 2** : Un utilisateur peut techniquement appartenir à plusieurs organisations, mais seul l'ID de la première organisation trouvée sera enregistré dans les logs.

**Solution future** : Permettre de spécifier quelle organisation utiliser, ou créer une organisation par défaut.

---

## ✅ Vérification

Pour vérifier que tout fonctionne :

1. **Créer une organisation** et noter son ID
2. **Ajouter un utilisateur** à cette organisation
3. **Faire une recherche** avec cet utilisateur
4. **Consulter les logs** et vérifier que `organization_id` est présent

```bash
# Vérifier les logs avec organization_id
curl -X GET "https://www.hscode.enclume-numerique.com/api/admin/usage-logs?organizationId=1" \
  -H "Authorization: Bearer <admin-token>"
```

Les logs doivent contenir `organizationId: 1` pour toutes les recherches de l'utilisateur associé.


