# Processus Pratiques - Création d'Utilisateurs et d'Entreprises

Ce document décrit les processus pratiques actuels et recommandés pour la création d'utilisateurs et d'entreprises.

## 📊 Vue d'Ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROCESSUS ACTUELS                             │
└─────────────────────────────────────────────────────────────────┘

1. INSCRIPTION UTILISATEUR (Public)
   ┌─────────────────┐
   │ /auth/register  │ → Crée utilisateur dans Keycloak
   └─────────────────┘ → Rôle: USER
                        → Aucune organisation associée
                        → Quota: Illimité

2. CRÉATION ENTREPRISE (Admin uniquement)
   ┌──────────────────────────────┐
   │ POST /admin/organizations    │ → Crée entreprise
   └──────────────────────────────┘ → Définit quota (optionnel)

3. ASSOCIATION UTILISATEUR-ENTREPRISE (Admin uniquement)
   ┌──────────────────────────────────────┐
   │ POST /admin/organizations/{id}/users │ → Associe utilisateur
   └──────────────────────────────────────┘ → Nécessite Keycloak User ID
```

## 🔄 Processus Détaillés

### Processus 1 : Inscription Utilisateur (Actuel)

```
┌──────────────┐
│  Utilisateur │
└──────┬───────┘
       │
       │ 1. Accède à /auth/register
       ▼
┌─────────────────────┐
│  Formulaire         │
│  - username         │
│  - email            │
│  - password         │
│  - firstName        │
│  - lastName         │
└──────┬──────────────┘
       │
       │ 2. Soumet le formulaire
       ▼
┌─────────────────────┐
│  Backend            │
│  POST /auth/register│
└──────┬──────────────┘
       │
       │ 3. Crée utilisateur dans Keycloak
       ▼
┌─────────────────────┐
│  Keycloak           │
│  - Utilisateur créé │
│  - Rôle: USER       │
│  - Email non vérifié│
└──────┬──────────────┘
       │
       │ 4. Réponse succès
       ▼
┌─────────────────────┐
│  Utilisateur        │
│  - Peut se connecter│
│  - Aucune org       │
│  - Quota illimité   │
└─────────────────────┘
```

**Résultat** :
- ✅ Utilisateur créé dans Keycloak
- ✅ Peut se connecter immédiatement
- ❌ Aucune association à une organisation
- ✅ Quota illimité (pas de vérification)

---

### Processus 2 : Création d'Entreprise (Actuel)

```
┌──────────────┐
│  Admin       │
└──────┬───────┘
       │
       │ 1. Se connecte avec rôle ADMIN
       ▼
┌─────────────────────┐
│  Backend            │
│  POST /admin/       │
│  organizations      │
│  {                  │
│    "name": "..."    │
│  }                  │
└──────┬──────────────┘
       │
       │ 2. Crée entreprise
       ▼
┌─────────────────────┐
│  Base de Données    │
│  - Organisation     │
│  - monthlyQuota:null│
└──────┬──────────────┘
       │
       │ 3. Optionnel: Définit quota
       ▼
┌─────────────────────┐
│  PUT /admin/        │
│  organizations/{id}/│
│  quota              │
│  {                  │
│    "monthlyQuota":  │
│      100            │
│  }                  │
└─────────────────────┘
```

**Résultat** :
- ✅ Entreprise créée
- ✅ Quota défini (optionnel)
- ❌ Aucun utilisateur associé

---

### Processus 3 : Association Utilisateur-Entreprise (Actuel)

```
┌──────────────┐
│  Admin       │
└──────┬───────┘
       │
       │ 1. Récupère Keycloak User ID
       │    (via Keycloak Admin ou autre moyen)
       ▼
┌─────────────────────┐
│  Backend            │
│  POST /admin/       │
│  organizations/{id}/│
│  users              │
│  {                  │
│    "keycloakUserId":│
│      "user-id"      │
│  }                  │
└──────┬──────────────┘
       │
       │ 2. Associe utilisateur à l'entreprise
       ▼
┌─────────────────────┐
│  Base de Données    │
│  - OrganizationUser │
│  - organization_id  │
│  - keycloak_user_id │
└─────────────────────┘
```

**Résultat** :
- ✅ Utilisateur associé à l'entreprise
- ✅ Quota de l'entreprise appliqué
- ❌ Processus manuel et fastidieux

---

## 🎯 Processus Recommandés (Futurs)

### Processus 4 : Inscription avec Code d'Invitation (Recommandé)

```
┌──────────────┐
│  Admin       │
└──────┬───────┘
       │
       │ 1. Génère code d'invitation
       ▼
┌─────────────────────┐
│  POST /admin/       │
│  organizations/{id}/│
│  invitation-codes   │
│  {                  │
│    "count": 10,     │
│    "expiresInDays": │
│      30             │
│  }                  │
└──────┬──────────────┘
       │
       │ 2. Distribue les codes
       ▼
┌──────────────┐
│  Utilisateur │
└──────┬───────┘
       │
       │ 3. S'inscrit avec code
       ▼
┌─────────────────────┐
│  /auth/register     │
│  ?invitationCode=   │
│  ABC123             │
│  + Formulaire       │
└──────┬──────────────┘
       │
       │ 4. Validation du code
       ▼
┌─────────────────────┐
│  Backend            │
│  - Crée utilisateur │
│  - Valide code      │
│  - Associe auto     │
└─────────────────────┘
```

**Avantages** :
- ✅ Association automatique
- ✅ Pas d'intervention admin nécessaire
- ✅ Contrôle par les entreprises

---

## 📋 Guide Pratique pour les Admins

### Étape 1 : Créer une Entreprise

```bash
# 1. Se connecter et obtenir un token ADMIN
TOKEN="votre-token-admin"

# 2. Créer l'entreprise
curl -X POST "https://www.hscode.enclume-numerique.com/api/admin/organizations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Entreprise ABC"
  }'

# Réponse: { "id": 1, "name": "Entreprise ABC", ... }
```

### Étape 2 : Définir le Quota

```bash
# Définir un quota de 100 requêtes/mois
curl -X PUT "https://www.hscode.enclume-numerique.com/api/admin/organizations/1/quota" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "monthlyQuota": 100
  }'
```

### Étape 3 : Récupérer la Liste des Utilisateurs Keycloak

**Option A : Via Keycloak Admin Console**
1. Se connecter à Keycloak Admin Console
2. Aller dans "Users"
3. Copier l'ID de l'utilisateur (colonne "ID")

**Option B : Via API Keycloak (à implémenter)**
```bash
# Endpoint à créer: GET /admin/users
curl -X GET "https://www.hscode.enclume-numerique.com/api/admin/users" \
  -H "Authorization: Bearer $TOKEN"
```

### Étape 4 : Associer un Utilisateur à l'Entreprise

```bash
# Associer un utilisateur à l'entreprise
curl -X POST "https://www.hscode.enclume-numerique.com/api/admin/organizations/1/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "keycloakUserId": "user-keycloak-id"
  }'
```

### Étape 5 : Vérifier l'Association

```bash
# Lister les utilisateurs de l'entreprise
curl -X GET "https://www.hscode.enclume-numerique.com/api/admin/organizations/1/users" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🔍 Problèmes Actuels et Solutions

### Problème 1 : Récupération du Keycloak User ID

**Problème** : L'admin doit connaître le Keycloak User ID pour associer un utilisateur.

**Solution Actuelle** : Via Keycloak Admin Console (manuel)

**Solution Recommandée** : Créer un endpoint pour lister les utilisateurs
```java
@GetMapping("/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public List<UserDto> getUsers(@RequestParam(required = false) String search) {
    // Lister les utilisateurs Keycloak
    // Permettre la recherche par nom/email
}
```

### Problème 2 : Processus Manuel

**Problème** : L'association utilisateur-entreprise est manuelle et fastidieuse.

**Solution Recommandée** : Implémenter les codes d'invitation
- Génération de codes par l'admin
- Distribution des codes aux utilisateurs
- Association automatique lors de l'inscription

### Problème 3 : Pas d'Interface Admin

**Problème** : Toutes les opérations se font via API (curl).

**Solution Recommandée** : Créer une interface admin
- Page pour créer des entreprises
- Page pour associer des utilisateurs
- Recherche d'utilisateurs par nom/email
- Gestion des quotas

---

## 🚀 Améliorations Prioritaires

### Priorité 1 : Endpoint pour Lister les Utilisateurs
- **Complexité** : Faible
- **Impact** : Élevé
- **Temps estimé** : 2-3 heures

### Priorité 2 : Recherche par Email
- **Complexité** : Faible
- **Impact** : Élevé
- **Temps estimé** : 1-2 heures

### Priorité 3 : Codes d'Invitation
- **Complexité** : Moyenne
- **Impact** : Très élevé
- **Temps estimé** : 1-2 jours

### Priorité 4 : Interface Admin
- **Complexité** : Élevée
- **Impact** : Très élevé
- **Temps estimé** : 3-5 jours

---

## 📝 Checklist pour Créer une Entreprise

### Pour l'Admin

- [ ] Se connecter avec le rôle ADMIN
- [ ] Créer l'entreprise via `POST /admin/organizations`
- [ ] Noter l'ID de l'entreprise
- [ ] Définir le quota via `PUT /admin/organizations/{id}/quota`
- [ ] Récupérer la liste des utilisateurs Keycloak
- [ ] Pour chaque utilisateur :
  - [ ] Identifier le Keycloak User ID
  - [ ] Associer via `POST /admin/organizations/{id}/users`
- [ ] Vérifier l'association via `GET /admin/organizations/{id}/users`

---

## 🔗 Ressources

- **Documentation complète** : `STRATEGIE_CREATION_UTILISATEURS_ENTREPRISES.md`
- **Endpoints API** : Swagger UI (`/swagger-ui.html`)
- **Keycloak Admin** : Console Keycloak

---

*Dernière mise à jour : Processus actuels documentés*

