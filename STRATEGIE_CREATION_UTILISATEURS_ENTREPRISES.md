# Stratégie de Création d'Utilisateurs et d'Entreprises

Ce document décrit la stratégie et les processus pratiques pour la création d'utilisateurs et d'entreprises dans le système.

## 📋 État Actuel

### Création d'Utilisateurs
- ✅ **Endpoint public** : `POST /auth/register` (accessible sans authentification)
- ✅ **Création directe dans Keycloak** : L'utilisateur est créé immédiatement
- ✅ **Rôle par défaut** : USER (à vérifier dans Keycloak)
- ✅ **Pas d'association automatique** : L'utilisateur n'est pas associé à une organisation

### Création d'Entreprises
- ✅ **Endpoint admin** : `POST /admin/organizations` (nécessite le rôle ADMIN)
- ✅ **Création manuelle** : Seul un admin peut créer une entreprise
- ✅ **Pas de processus automatisé** : Pas d'auto-création par les utilisateurs

### Association Utilisateur-Entreprise
- ✅ **Endpoint admin** : `POST /admin/organizations/{id}/users` (nécessite le rôle ADMIN)
- ✅ **Association manuelle** : Un admin doit associer manuellement un utilisateur à une organisation
- ✅ **Nécessite le Keycloak User ID** : L'admin doit connaître l'ID Keycloak de l'utilisateur

## 🎯 Scénarios d'Utilisation

### Scénario 1 : Inscription Libre (Utilisateur Individuel)
**Cas d'usage** : Un utilisateur s'inscrit seul, sans appartenance à une entreprise.

**Processus actuel** :
1. L'utilisateur accède à `/auth/register`
2. Il remplit le formulaire (username, email, password, firstName, lastName)
3. L'utilisateur est créé dans Keycloak
4. Il peut se connecter et utiliser l'application
5. **Aucune association à une organisation** → Quota illimité (pas de vérification)

**Avantages** :
- ✅ Simple et rapide
- ✅ Aucune barrière à l'entrée
- ✅ Permet aux utilisateurs individuels d'utiliser le service

**Inconvénients** :
- ❌ Pas de facturation possible (pas d'organisation)
- ❌ Pas de suivi par entreprise
- ❌ Utilisateurs non regroupés

**Recommandation** : ✅ **Conserver ce processus** pour les utilisateurs individuels

---

### Scénario 2 : Création d'Entreprise par un Admin
**Cas d'usage** : Un administrateur crée une entreprise manuellement.

**Processus actuel** :
1. L'admin se connecte avec le rôle ADMIN
2. Il accède à l'endpoint `POST /admin/organizations`
3. Il crée l'entreprise avec un nom
4. Il définit le quota (optionnel)
5. Il associe des utilisateurs à l'entreprise

**Avantages** :
- ✅ Contrôle total par l'admin
- ✅ Permet de définir les quotas avant d'ajouter des utilisateurs
- ✅ Gestion centralisée

**Inconvénients** :
- ❌ Processus manuel et fastidieux
- ❌ Nécessite un admin pour chaque nouvelle entreprise
- ❌ Pas de processus automatisé

**Recommandation** : ✅ **Conserver ce processus** pour la gestion manuelle par les admins

---

### Scénario 3 : Association Utilisateur-Entreprise par un Admin
**Cas d'usage** : Un admin associe un utilisateur existant à une entreprise.

**Processus actuel** :
1. L'admin récupère la liste des utilisateurs Keycloak (manuellement ou via l'interface)
2. Il identifie le Keycloak User ID de l'utilisateur
3. Il appelle `POST /admin/organizations/{id}/users` avec le Keycloak User ID
4. L'utilisateur est associé à l'entreprise

**Avantages** :
- ✅ Contrôle par l'admin
- ✅ Permet d'associer des utilisateurs existants

**Inconvénients** :
- ❌ Nécessite de connaître le Keycloak User ID
- ❌ Processus manuel
- ❌ Pas d'interface utilisateur pour faciliter cette opération

**Recommandation** : ⚠️ **Améliorer ce processus** avec une interface admin

---

## 🚀 Stratégies Proposées

### Stratégie 1 : Inscription avec Code d'Invitation (Recommandée)

**Principe** : Les entreprises peuvent générer des codes d'invitation que les utilisateurs utilisent lors de l'inscription.

**Processus** :
1. **Admin crée une entreprise** :
   - Crée l'entreprise via `POST /admin/organizations`
   - Définit le quota
   - Génère des codes d'invitation (optionnel)

2. **Utilisateur s'inscrit avec code d'invitation** :
   - Accède à `/auth/register`
   - Remplit le formulaire + code d'invitation
   - L'utilisateur est créé dans Keycloak
   - **Association automatique** à l'entreprise si le code est valide

3. **Utilisateur s'inscrit sans code** :
   - Accède à `/auth/register`
   - Remplit le formulaire (sans code)
   - L'utilisateur est créé dans Keycloak
   - **Aucune association** (utilisateur individuel)

**Avantages** :
- ✅ Association automatique lors de l'inscription
- ✅ Pas besoin d'intervention admin pour associer les utilisateurs
- ✅ Les utilisateurs individuels peuvent toujours s'inscrire
- ✅ Contrôle par les entreprises (génération de codes)

**Implémentation nécessaire** :
- Ajouter un champ `invitationCode` (optionnel) au formulaire d'inscription
- Créer une table `invitation_code` (code, organization_id, utilisé, expiré, etc.)
- Endpoint pour générer des codes d'invitation (ADMIN)
- Logique d'association automatique lors de l'inscription

---

### Stratégie 2 : Demande d'Adhésion à une Entreprise

**Principe** : Les utilisateurs peuvent demander à rejoindre une entreprise, et un admin valide la demande.

**Processus** :
1. **Utilisateur s'inscrit** :
   - S'inscrit normalement via `/auth/register`
   - Aucune association initiale

2. **Utilisateur demande à rejoindre une entreprise** :
   - Accède à une page "Rejoindre une entreprise"
   - Recherche l'entreprise (par nom)
   - Envoie une demande d'adhésion

3. **Admin valide la demande** :
   - Reçoit une notification (email ou dans l'interface admin)
   - Valide ou refuse la demande
   - Si validé, l'utilisateur est associé à l'entreprise

**Avantages** :
- ✅ Les utilisateurs peuvent initier le processus
- ✅ Contrôle par l'admin (validation)
- ✅ Permet de gérer les demandes en attente

**Inconvénients** :
- ❌ Processus en deux étapes (demande + validation)
- ❌ Nécessite un système de notifications
- ❌ Plus complexe à implémenter

**Implémentation nécessaire** :
- Table `organization_membership_request` (user_id, organization_id, status, created_at)
- Endpoint pour créer une demande (USER)
- Endpoint pour lister les demandes (ADMIN)
- Endpoint pour valider/refuser une demande (ADMIN)
- Interface utilisateur pour les demandes

---

### Stratégie 3 : Auto-Création d'Entreprise par Utilisateur

**Principe** : Les utilisateurs peuvent créer leur propre entreprise lors de l'inscription ou après.

**Processus** :
1. **Utilisateur s'inscrit avec création d'entreprise** :
   - Accède à `/auth/register`
   - Remplit le formulaire + nom de l'entreprise
   - L'utilisateur est créé dans Keycloak
   - **L'entreprise est créée automatiquement**
   - L'utilisateur est associé à l'entreprise comme ADMIN de l'entreprise

2. **Utilisateur crée une entreprise après inscription** :
   - Utilisateur déjà inscrit
   - Accède à une page "Créer mon entreprise"
   - Crée l'entreprise
   - Est automatiquement associé comme ADMIN

**Avantages** :
- ✅ Processus automatisé
- ✅ Pas besoin d'intervention admin
- ✅ Les utilisateurs peuvent créer leur entreprise immédiatement

**Inconvénients** :
- ❌ Pas de contrôle sur la création d'entreprises
- ❌ Risque de création d'entreprises fantômes
- ❌ Nécessite un système de rôles par entreprise (ADMIN de l'entreprise vs ADMIN global)

**Implémentation nécessaire** :
- Endpoint pour créer une entreprise (USER) - avec validation
- Système de rôles par entreprise (ADMIN, MEMBER)
- Logique d'association automatique lors de la création
- Validation des noms d'entreprises (éviter les doublons)

---

## 📊 Comparaison des Stratégies

| Stratégie | Complexité | Contrôle | Automatisation | Recommandation |
|-----------|------------|----------|----------------|----------------|
| **1. Code d'Invitation** | Moyenne | Élevé | Élevée | ⭐⭐⭐⭐⭐ Recommandée |
| **2. Demande d'Adhésion** | Élevée | Très élevé | Faible | ⭐⭐⭐ Pour phase future |
| **3. Auto-Création** | Faible | Faible | Très élevée | ⭐⭐ Pour utilisateurs individuels |

## 🎯 Recommandation : Approche Hybride

### Phase Actuelle (MVP)
✅ **Conserver les processus existants** :
- Inscription libre (utilisateur individuel)
- Création d'entreprise par admin
- Association manuelle par admin

### Phase Suivante (Amélioration)
✅ **Implémenter la Stratégie 1 (Code d'Invitation)** :
- Permet l'association automatique lors de l'inscription
- Améliore l'expérience utilisateur
- Garde le contrôle par les entreprises

### Phase Future (Avancée)
✅ **Implémenter la Stratégie 2 (Demande d'Adhésion)** :
- Permet aux utilisateurs de demander à rejoindre une entreprise
- Système de validation par les admins
- Gestion des demandes en attente

## 🔄 Processus Pratique Recommandé

### Pour les Utilisateurs Individuels
1. **Inscription** : Accès à `/auth/register`
2. **Création** : Formulaire rempli → Utilisateur créé dans Keycloak
3. **Utilisation** : Accès immédiat à l'application (quota illimité)

### Pour les Entreprises (Processus Actuel)
1. **Admin crée l'entreprise** :
   ```bash
   POST /admin/organizations
   {
     "name": "Entreprise ABC"
   }
   ```

2. **Admin définit le quota** :
   ```bash
   PUT /admin/organizations/{id}/quota
   {
     "monthlyQuota": 100
   }
   ```

3. **Admin récupère la liste des utilisateurs Keycloak** :
   - Via l'interface Keycloak Admin
   - Ou via un endpoint à créer pour lister les utilisateurs

4. **Admin associe un utilisateur à l'entreprise** :
   ```bash
   POST /admin/organizations/{id}/users
   {
     "keycloakUserId": "user-keycloak-id"
   }
   ```

### Pour les Entreprises (Processus Amélioré - Phase Suivante)
1. **Admin crée l'entreprise** :
   ```bash
   POST /admin/organizations
   {
     "name": "Entreprise ABC"
   }
   ```

2. **Admin génère des codes d'invitation** :
   ```bash
   POST /admin/organizations/{id}/invitation-codes
   {
     "count": 10,
     "expiresInDays": 30
   }
   ```

3. **Admin distribue les codes** :
   - Par email
   - Via un lien d'invitation
   - Manuellement

4. **Utilisateur s'inscrit avec le code** :
   - Accède à `/auth/register?invitationCode=ABC123`
   - Remplit le formulaire
   - **Association automatique** à l'entreprise

## 📝 Améliorations Nécessaires

### Court Terme (Améliorer le Processus Actuel)
1. **Endpoint pour lister les utilisateurs Keycloak** :
   - `GET /admin/users` - Liste tous les utilisateurs Keycloak
   - Facilite l'association utilisateur-entreprise

2. **Interface Admin pour gérer les entreprises** :
   - Page admin pour créer des entreprises
   - Page admin pour associer des utilisateurs
   - Recherche d'utilisateurs par nom/email

3. **Amélioration de l'endpoint d'association** :
   - Accepter l'email au lieu du Keycloak User ID
   - Recherche automatique de l'utilisateur par email

### Moyen Terme (Stratégie 1 : Code d'Invitation)
1. **Table `invitation_code`** :
   - `id`, `code`, `organization_id`, `created_by`, `used`, `used_by`, `expires_at`, `created_at`

2. **Endpoints pour les codes d'invitation** :
   - `POST /admin/organizations/{id}/invitation-codes` - Générer des codes
   - `GET /admin/organizations/{id}/invitation-codes` - Lister les codes
   - `DELETE /admin/invitation-codes/{id}` - Révoquer un code

3. **Modification de l'inscription** :
   - Ajouter le champ `invitationCode` (optionnel)
   - Logique d'association automatique si code valide

4. **Interface utilisateur** :
   - Formulaire d'inscription avec champ code d'invitation
   - Validation du code en temps réel

### Long Terme (Stratégie 2 : Demande d'Adhésion)
1. **Table `organization_membership_request`** :
   - `id`, `user_id`, `organization_id`, `status`, `message`, `created_at`, `processed_at`, `processed_by`

2. **Endpoints pour les demandes** :
   - `POST /organizations/{id}/join-request` - Créer une demande (USER)
   - `GET /admin/organizations/{id}/join-requests` - Lister les demandes (ADMIN)
   - `POST /admin/organizations/{id}/join-requests/{id}/approve` - Approuver (ADMIN)
   - `POST /admin/organizations/{id}/join-requests/{id}/reject` - Refuser (ADMIN)

3. **Interface utilisateur** :
   - Page "Rejoindre une entreprise"
   - Recherche d'entreprises
   - Liste des demandes en attente
   - Notifications pour les admins

## 🔐 Sécurité et Contrôles

### Contrôles Actuels
- ✅ Inscription publique (pas de restriction)
- ✅ Création d'entreprise réservée aux ADMIN
- ✅ Association utilisateur-entreprise réservée aux ADMIN

### Contrôles Recommandés
- ✅ Validation des codes d'invitation (expiration, usage unique)
- ✅ Limitation du nombre de codes par entreprise
- ✅ Validation des demandes d'adhésion
- ✅ Vérification des doublons (utilisateur déjà dans une entreprise)

## 📚 Documentation Technique

### Endpoints Existants
- `POST /auth/register` - Inscription utilisateur (public)
- `POST /admin/organizations` - Créer une entreprise (ADMIN)
- `POST /admin/organizations/{id}/users` - Associer un utilisateur (ADMIN)

### Endpoints à Créer (Phase Suivante)
- `GET /admin/users` - Lister les utilisateurs Keycloak (ADMIN)
- `POST /admin/organizations/{id}/invitation-codes` - Générer des codes (ADMIN)
- `GET /admin/organizations/{id}/invitation-codes` - Lister les codes (ADMIN)
- `DELETE /admin/invitation-codes/{id}` - Révoquer un code (ADMIN)

## 🎯 Prochaines Étapes

1. **Analyser les besoins** : Déterminer quel scénario est le plus fréquent
2. **Prioriser les améliorations** : Commencer par les améliorations court terme
3. **Implémenter la Stratégie 1** : Code d'invitation (si nécessaire)
4. **Créer une interface admin** : Faciliter la gestion des entreprises et utilisateurs
5. **Documenter les processus** : Guide pour les admins

---

*Dernière mise à jour : Analyse de l'état actuel et recommandations*

