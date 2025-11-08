# Exemples de Code : Organisation et OrganizationUser

## 📋 Exemples Java

### Exemple 1 : Créer une Organisation (via Service)

```java
// Dans OrganizationService
Organization organization = new Organization();
organization.setName("Acme Corporation");
organization = organizationRepository.save(organization);

// Résultat :
// Organization {
//   id: 1,
//   name: "Acme Corporation",
//   createdAt: 2025-01-20T10:00:00
// }
```

### Exemple 2 : Créer une Association Utilisateur-Organisation

```java
// Dans OrganizationService
Organization organization = organizationRepository.findById(1L).orElseThrow();

OrganizationUser organizationUser = new OrganizationUser();
organizationUser.setOrganization(organization);
organizationUser.setKeycloakUserId("123e4567-e89b-12d3-a456-426614174000");
organizationUser = organizationUserRepository.save(organizationUser);

// Résultat :
// OrganizationUser {
//   id: 1,
//   organization: Organization{id: 1, name: "Acme Corporation", ...},
//   keycloakUserId: "123e4567-e89b-12d3-a456-426614174000",
//   joinedAt: 2025-01-20T10:05:00
// }
```

### Exemple 3 : Récupérer l'Organisation d'un Utilisateur

```java
// Dans OrganizationService
String keycloakUserId = "123e4567-e89b-12d3-a456-426614174000";
List<OrganizationUser> organizationUsers = 
    organizationUserRepository.findByKeycloakUserId(keycloakUserId);

if (!organizationUsers.isEmpty()) {
    Long organizationId = organizationUsers.get(0).getOrganization().getId();
    // organizationId = 1
}
```

### Exemple 4 : Enregistrer un Log avec Organisation

```java
// Dans UsageLogService
String keycloakUserId = "123e4567-e89b-12d3-a456-426614174000";
Long organizationId = 1L; // Récupéré depuis OrganizationService

UsageLog usageLog = new UsageLog();
usageLog.setKeycloakUserId(keycloakUserId);
usageLog.setOrganizationId(organizationId);
usageLog.setEndpoint("/recherche/positions6");
usageLog.setSearchTerm("figues");
usageLog.setTokensUsed(150);
usageLog.setCostUsd(BigDecimal.valueOf(0.000045));
usageLog.setTimestamp(LocalDateTime.now());

repository.save(usageLog);

// Résultat en base :
// UsageLog {
//   id: 1,
//   keycloakUserId: "123e4567-e89b-12d3-a456-426614174000",
//   organizationId: 1,
//   endpoint: "/recherche/positions6",
//   searchTerm: "figues",
//   tokensUsed: 150,
//   costUsd: 0.000045,
//   timestamp: 2025-01-20T11:00:00
// }
```

---

## 📊 Exemples JSON (Réponses API)

### Exemple 1 : OrganisationDto

```json
{
  "id": 1,
  "name": "Acme Corporation",
  "createdAt": "2025-01-20T10:00:00",
  "userCount": 3
}
```

### Exemple 2 : OrganizationUserDto

```json
{
  "id": 1,
  "organizationId": 1,
  "organizationName": "Acme Corporation",
  "keycloakUserId": "123e4567-e89b-12d3-a456-426614174000",
  "joinedAt": "2025-01-20T10:05:00"
}
```

### Exemple 3 : Liste d'Organisations

```json
[
  {
    "id": 1,
    "name": "Acme Corporation",
    "createdAt": "2025-01-20T10:00:00",
    "userCount": 3
  },
  {
    "id": 2,
    "name": "TechCorp",
    "createdAt": "2025-01-21T09:00:00",
    "userCount": 2
  },
  {
    "id": 3,
    "name": "Global Industries",
    "createdAt": "2025-01-22T14:30:00",
    "userCount": 1
  }
]
```

### Exemple 4 : Liste d'Utilisateurs d'une Organisation

```json
[
  {
    "id": 1,
    "organizationId": 1,
    "organizationName": "Acme Corporation",
    "keycloakUserId": "123e4567-e89b-12d3-a456-426614174000",
    "joinedAt": "2025-01-20T10:05:00"
  },
  {
    "id": 2,
    "organizationId": 1,
    "organizationName": "Acme Corporation",
    "keycloakUserId": "987f6543-e21b-12d3-a456-426614174000",
    "joinedAt": "2025-01-20T10:10:00"
  },
  {
    "id": 3,
    "organizationId": 1,
    "organizationName": "Acme Corporation",
    "keycloakUserId": "456e7890-e12b-34d5-a456-426614174000",
    "joinedAt": "2025-01-20T10:15:00"
  }
]
```

### Exemple 5 : UsageLog avec OrganizationId

```json
{
  "id": 1,
  "keycloakUserId": "123e4567-e89b-12d3-a456-426614174000",
  "organizationId": 1,
  "endpoint": "/recherche/positions6",
  "searchTerm": "figues",
  "tokensUsed": 150,
  "costUsd": 0.000045,
  "timestamp": "2025-01-20T11:00:00"
}
```

---

## 🔄 Scénario Complet : Exemple Réel

### Étape 1 : Créer l'Organisation "TechCorp"

**Requête** :
```http
POST /admin/organizations
{
  "name": "TechCorp"
}
```

**Réponse** :
```json
{
  "id": 1,
  "name": "TechCorp",
  "createdAt": "2025-01-20T10:00:00",
  "userCount": 0
}
```

### Étape 2 : Ajouter l'Utilisateur "moh"

**Requête** :
```http
POST /admin/organizations/1/users
{
  "keycloakUserId": "keycloak-user-id-moh"
}
```

**Réponse** :
```json
{
  "id": 1,
  "organizationId": 1,
  "organizationName": "TechCorp",
  "keycloakUserId": "keycloak-user-id-moh",
  "joinedAt": "2025-01-20T10:05:00"
}
```

### Étape 3 : L'Utilisateur "moh" Fait une Recherche

Quand l'utilisateur "moh" fait une recherche sur "figues" :
- Le système récupère automatiquement `organizationId = 1`
- Le log est enregistré avec `organizationId = 1`

**Log enregistré** :
```json
{
  "id": 1,
  "keycloakUserId": "keycloak-user-id-moh",
  "organizationId": 1,
  "endpoint": "/recherche/positions6",
  "searchTerm": "figues",
  "tokensUsed": 150,
  "costUsd": 0.000045,
  "timestamp": "2025-01-20T11:00:00"
}
```

### Étape 4 : Consulter les Logs de TechCorp

**Requête** :
```http
GET /admin/usage-logs?organizationId=1
```

**Réponse** :
```json
{
  "total": 1,
  "totalCostUsd": 0.000045,
  "totalTokens": 150,
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
    }
  ]
}
```

---

## 📝 Structure des Données en Base

### Table `organization`

| id | name              | created_at           |
|----|-------------------|----------------------|
| 1  | TechCorp          | 2025-01-20 10:00:00  |
| 2  | Acme Corporation  | 2025-01-21 09:00:00  |
| 3  | Global Industries | 2025-01-22 14:30:00 |

### Table `organization_user`

| id | organization_id | keycloak_user_id              | joined_at           |
|----|-----------------|-------------------------------|---------------------|
| 1  | 1               | keycloak-user-id-moh          | 2025-01-20 10:05:00 |
| 2  | 1               | keycloak-user-id-admin        | 2025-01-20 10:10:00 |
| 3  | 2               | keycloak-user-id-user1        | 2025-01-21 09:05:00 |
| 4  | 3               | keycloak-user-id-user2        | 2025-01-22 14:35:00 |

### Table `usage_log` (avec organization_id)

| id | keycloak_user_id      | organization_id | endpoint              | search_term | tokens_used | cost_usd | timestamp           |
|----|------------------------|-----------------|----------------------|-------------|-------------|----------|---------------------|
| 1  | keycloak-user-id-moh  | 1               | /recherche/positions6| figues      | 150         | 0.000045 | 2025-01-20 11:00:00 |
| 2  | keycloak-user-id-moh  | 1               | /recherche/sections  | voitures    | 100         | 0.000030 | 2025-01-20 11:05:00 |
| 3  | keycloak-user-id-admin| 1               | /recherche/chapitres | fruits      | 120         | 0.000036 | 2025-01-20 11:10:00 |
| 4  | keycloak-user-id-user1| 2               | /recherche/positions6| machines    | 200         | 0.000060 | 2025-01-21 10:00:00 |
| 5  | keycloak-user-id-user2| 3               | /recherche/sections  | textiles    | 80          | 0.000024 | 2025-01-22 15:00:00 |

---

## 🎯 Cas d'Usage Concrets

### Cas 1 : Entreprise avec 2 Utilisateurs

**Organisation** :
```json
{
  "id": 1,
  "name": "Entreprise ABC",
  "createdAt": "2025-01-20T10:00:00"
}
```

**Utilisateurs** :
```json
[
  {
    "keycloakUserId": "user-1-id",
    "organizationId": 1,
    "joinedAt": "2025-01-20T10:05:00"
  },
  {
    "keycloakUserId": "user-2-id",
    "organizationId": 1,
    "joinedAt": "2025-01-20T10:10:00"
  }
]
```

**Logs d'utilisation** :
- Tous les logs de `user-1-id` et `user-2-id` ont `organizationId = 1`
- On peut consulter tous les logs de l'entreprise avec `?organizationId=1`

### Cas 2 : Utilisateur Sans Organisation

**Logs** :
```json
{
  "keycloakUserId": "user-without-org",
  "organizationId": null,  // ← Pas d'organisation
  "endpoint": "/recherche/positions6",
  "searchTerm": "figues",
  ...
}
```

**Comportement** :
- Les recherches fonctionnent normalement
- Les logs sont enregistrés avec `organizationId = null`
- On peut toujours consulter les logs par `keycloakUserId`

---

## ✅ Vérification Rapide

Pour vérifier que tout fonctionne :

```bash
# 1. Créer une organisation
curl -X POST /admin/organizations \
  -H "Authorization: Bearer <token>" \
  -d '{"name": "Test Org"}'

# 2. Noter l'ID retourné (ex: 1)

# 3. Ajouter un utilisateur
curl -X POST /admin/organizations/1/users \
  -H "Authorization: Bearer <token>" \
  -d '{"keycloakUserId": "user-id"}'

# 4. Faire une recherche avec cet utilisateur
# (se connecter avec l'utilisateur et faire une recherche)

# 5. Vérifier les logs
curl -X GET "/admin/usage-logs?organizationId=1" \
  -H "Authorization: Bearer <token>"

# Les logs doivent contenir organizationId: 1
```


