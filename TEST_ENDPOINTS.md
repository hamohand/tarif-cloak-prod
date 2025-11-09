# 🧪 Guide de Test des Endpoints

## 📋 Endpoints à Tester

### 1. Endpoint de Santé (Public)

**URL** : `GET /api/health`

**Authentification** : Aucune

**Test** :
```bash
curl -k https://www.hscode.enclume-numerique.com/api/health
```

**Résultat attendu** :
```json
{
  "status": "UP",
  "service": "backend",
  "message": "Backend is running"
}
```

### 2. Endpoint des Organisations (Admin)

**URL** : `GET /api/admin/organizations`

**Authentification** : Requiert le rôle ADMIN

**Test** :
```bash
# Obtenir un token JWT (connectez-vous d'abord dans le navigateur)
# Puis utilisez le token dans la requête
curl -X GET \
  https://www.hscode.enclume-numerique.com/api/admin/organizations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**Résultat attendu** :
```json
[
  {
    "id": 1,
    "name": "Organisation 1",
    "email": "org1@example.com",
    "monthlyQuota": 1000,
    "createdAt": "2024-01-01T00:00:00",
    "userCount": 5,
    "currentMonthUsage": 150
  }
]
```

### 3. Endpoint des Statistiques Utilisateur

**URL** : `GET /api/user/usage/stats`

**Authentification** : Requiert une authentification (rôle USER ou ADMIN)

**Test** :
```bash
curl -X GET \
  https://www.hscode.enclume-numerique.com/api/user/usage/stats \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**Avec paramètres de date** :
```bash
curl -X GET \
  "https://www.hscode.enclume-numerique.com/api/user/usage/stats?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**Résultat attendu** :
```json
{
  "totalRequests": 150,
  "totalCostUsd": 0.123456,
  "totalTokens": 50000,
  "monthlyRequests": 150,
  "recentUsage": [
    {
      "id": 1,
      "keycloakUserId": "user-id",
      "organizationId": 1,
      "endpoint": "/recherche/positions6",
      "searchTerm": "figues",
      "tokensUsed": 1000,
      "costUsd": 0.001234,
      "timestamp": "2024-01-01T10:00:00"
    }
  ],
  "quotaInfo": {
    "monthlyQuota": 1000,
    "currentUsage": 150,
    "personalUsage": 150,
    "remaining": 850,
    "percentageUsed": 15.0
  }
}
```

### 4. Endpoint du Quota Utilisateur

**URL** : `GET /api/user/quota`

**Authentification** : Requiert une authentification (rôle USER ou ADMIN)

**Test** :
```bash
curl -X GET \
  https://www.hscode.enclume-numerique.com/api/user/quota \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**Résultat attendu** :
```json
{
  "hasOrganization": true,
  "organizationId": 1,
  "organizationName": "Organisation 1",
  "monthlyQuota": 1000,
  "currentUsage": 150,
  "personalUsage": 150,
  "remaining": 850,
  "percentageUsed": 15.0,
  "isUnlimited": false
}
```

### 5. Endpoint des Alertes (Count)

**URL** : `GET /api/alerts/my-alerts/count`

**Authentification** : Requiert une authentification (rôle USER ou ADMIN)

**Test** :
```bash
curl -X GET \
  https://www.hscode.enclume-numerique.com/api/alerts/my-alerts/count \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**Résultat attendu** :
```json
{
  "count": 0
}
```

### 6. Endpoint des Alertes (Liste)

**URL** : `GET /api/alerts/my-alerts`

**Authentification** : Requiert une authentification (rôle USER ou ADMIN)

**Test** :
```bash
curl -X GET \
  https://www.hscode.enclume-numerique.com/api/alerts/my-alerts \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**Résultat attendu** :
```json
[
  {
    "id": 1,
    "organizationId": 1,
    "organizationName": "Organisation 1",
    "alertType": "WARNING",
    "message": "🟡 Quota mensuel proche de la limite...",
    "timestamp": "2024-01-01T10:00:00",
    "isRead": false
  }
]
```

### 7. Endpoint des Statistiques Admin

**URL** : `GET /api/admin/usage/stats`

**Authentification** : Requiert le rôle ADMIN

**Test** :
```bash
curl -X GET \
  https://www.hscode.enclume-numerique.com/api/admin/usage/stats \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**Avec filtre par organisation** :
```bash
curl -X GET \
  "https://www.hscode.enclume-numerique.com/api/admin/usage/stats?organizationId=1" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**Avec filtre par date** :
```bash
curl -X GET \
  "https://www.hscode.enclume-numerique.com/api/admin/usage/stats?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**Résultat attendu** :
```json
{
  "totalRequests": 1000,
  "totalCostUsd": 1.234567,
  "totalTokens": 500000,
  "statsByOrganization": [
    {
      "organizationId": 1,
      "organizationName": "Organisation 1",
      "requestCount": 500,
      "totalCostUsd": 0.617283,
      "totalTokens": 250000
    }
  ],
  "statsByUser": [
    {
      "keycloakUserId": "user-id",
      "requestCount": 150,
      "totalCostUsd": 0.185185,
      "totalTokens": 75000
    }
  ],
  "recentUsage": [
    {
      "id": 1,
      "keycloakUserId": "user-id",
      "organizationId": 1,
      "endpoint": "/recherche/positions6",
      "searchTerm": "figues",
      "tokensUsed": 1000,
      "costUsd": 0.001234,
      "timestamp": "2024-01-01T10:00:00"
    }
  ]
}
```

## 🔑 Obtenir un Token JWT

### Méthode 1 : Depuis le Navigateur

1. Ouvrir https://www.hscode.enclume-numerique.com
2. Se connecter avec vos identifiants
3. Ouvrir la console du navigateur (F12)
4. Aller dans l'onglet "Application" > "Storage" > "Local Storage"
5. Chercher le token JWT (généralement stocké par Keycloak)

### Méthode 2 : Depuis Keycloak

1. Se connecter à Keycloak Admin Console
2. Aller dans "Clients" > "frontend-client"
3. Tester la connexion et récupérer le token

### Méthode 3 : Depuis les Requêtes Réseau

1. Ouvrir la console du navigateur (F12)
2. Aller dans l'onglet "Network"
3. Effectuer une requête (ex: charger la page Stats)
4. Cliquer sur la requête vers `/api/admin/organizations`
5. Voir les headers de la requête
6. Copier le token depuis le header `Authorization: Bearer <token>`

## 🧪 Script de Test Automatique

### Script Bash

```bash
#!/bin/bash

# Configuration
API_URL="https://www.hscode.enclume-numerique.com/api"
TOKEN="<votre-token-jwt>"

# Test de l'endpoint de santé
echo "1. Test de l'endpoint de santé..."
curl -k "$API_URL/health"
echo ""

# Test de l'endpoint des organisations
echo "2. Test de l'endpoint des organisations..."
curl -k -X GET \
  "$API_URL/admin/organizations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
echo ""

# Test de l'endpoint des statistiques utilisateur
echo "3. Test de l'endpoint des statistiques utilisateur..."
curl -k -X GET \
  "$API_URL/user/usage/stats" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
echo ""

# Test de l'endpoint du quota
echo "4. Test de l'endpoint du quota..."
curl -k -X GET \
  "$API_URL/user/quota" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
echo ""

# Test de l'endpoint des alertes
echo "5. Test de l'endpoint des alertes..."
curl -k -X GET \
  "$API_URL/alerts/my-alerts/count" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
echo ""
```

### Script PowerShell

```powershell
# Configuration
$API_URL = "https://www.hscode.enclume-numerique.com/api"
$TOKEN = "<votre-token-jwt>"

# Test de l'endpoint de santé
Write-Host "1. Test de l'endpoint de santé..."
Invoke-WebRequest -Uri "$API_URL/health" -Method GET -SkipCertificateCheck
Write-Host ""

# Test de l'endpoint des organisations
Write-Host "2. Test de l'endpoint des organisations..."
Invoke-WebRequest -Uri "$API_URL/admin/organizations" `
  -Method GET `
  -Headers @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
  } `
  -SkipCertificateCheck
Write-Host ""

# Test de l'endpoint des statistiques utilisateur
Write-Host "3. Test de l'endpoint des statistiques utilisateur..."
Invoke-WebRequest -Uri "$API_URL/user/usage/stats" `
  -Method GET `
  -Headers @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
  } `
  -SkipCertificateCheck
Write-Host ""

# Test de l'endpoint du quota
Write-Host "4. Test de l'endpoint du quota..."
Invoke-WebRequest -Uri "$API_URL/user/quota" `
  -Method GET `
  -Headers @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
  } `
  -SkipCertificateCheck
Write-Host ""

# Test de l'endpoint des alertes
Write-Host "5. Test de l'endpoint des alertes..."
Invoke-WebRequest -Uri "$API_URL/alerts/my-alerts/count" `
  -Method GET `
  -Headers @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
  } `
  -SkipCertificateCheck
Write-Host ""
```

## 📊 Résultats Attendus

### Codes de Statut HTTP

- **200 OK** : Requête réussie
- **401 Unauthorized** : Token JWT manquant ou invalide
- **403 Forbidden** : Utilisateur n'a pas les permissions nécessaires
- **404 Not Found** : Endpoint non trouvé
- **500 Internal Server Error** : Erreur serveur
- **502 Bad Gateway** : Backend non accessible

### Réponses d'Erreur

**401 Unauthorized** :
```json
{
  "error": "Non autorisé",
  "message": "JWT expired"
}
```

**403 Forbidden** :
```json
{
  "error": "Accès refusé",
  "message": "Vous n'avez pas les permissions nécessaires"
}
```

**429 Too Many Requests** (quota dépassé) :
```json
{
  "timestamp": "2024-01-01T10:00:00",
  "status": 429,
  "error": "Too Many Requests",
  "message": "Quota mensuel dépassé pour l'organisation 'Organisation 1' (ID: 1). Utilisation: 1001/1000 requêtes",
  "path": "/api/recherche/positions6"
}
```

## 🔍 Dépannage

### Problème : 401 Unauthorized

**Cause** : Token JWT manquant ou invalide

**Solution** :
1. Vérifier que le token est présent dans la requête
2. Vérifier que le token n'est pas expiré
3. Se reconnecter pour obtenir un nouveau token

### Problème : 403 Forbidden

**Cause** : Utilisateur n'a pas les permissions nécessaires

**Solution** :
1. Vérifier que l'utilisateur a le bon rôle (ADMIN pour les endpoints admin)
2. Vérifier les rôles dans Keycloak
3. Se reconnecter après avoir modifié les rôles

### Problème : 502 Bad Gateway

**Cause** : Backend non accessible

**Solution** :
1. Vérifier que le backend est en cours d'exécution
2. Vérifier les logs du backend
3. Vérifier la configuration Traefik

### Problème : Réponse HTML au lieu de JSON

**Cause** : Requête routée vers le frontend au lieu du backend

**Solution** :
1. Vérifier que le backend est en cours d'exécution
2. Vérifier la configuration Traefik
3. Vérifier que l'URL est correcte (`/api/...`)

---

**Dernière mise à jour** : Après vérification que le backend démarre correctement

