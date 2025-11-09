# 🚀 Prochaines Étapes - Vérification Complète

## ✅ État Actuel (selon vous)

✅ **Backend démarre correctement** - Aucune erreur

## 📋 Étapes de Vérification

### Étape 1 : Vérifier l'État du Backend

```bash
# Vérifier que le backend est en cours d'exécution
docker ps | grep backend

# Vérifier les logs (dernières lignes)
docker logs hscode-backend --tail 50
```

**Signes de succès** :
- ✅ Le conteneur est en statut "Up" (pas "Restarting")
- ✅ Les logs montrent "Started BackendApplication"
- ✅ Aucune erreur "FATAL" ou "Exception"

### Étape 2 : Tester l'Endpoint de Santé

```bash
# Tester l'endpoint de santé
curl -k https://www.hscode.enclume-numerique.com/api/health
```

**Résultat attendu** :
```json
{"status":"UP","service":"backend","message":"Backend is running"}
```

**Sur Windows PowerShell** :
```powershell
Invoke-WebRequest -Uri "https://www.hscode.enclume-numerique.com/api/health" -Method GET -SkipCertificateCheck
```

### Étape 3 : Vérifier dans le Navigateur

#### 3.1 Page Stats (Admin)

**URL** : https://www.hscode.enclume-numerique.com/admin/stats

**Vérifications** :
- [ ] La page se charge sans erreur
- [ ] La liste déroulante des organisations contient les organisations (pas seulement "Toutes")
- [ ] Les statistiques s'affichent correctement
- [ ] Les graphiques s'affichent correctement
- [ ] Aucune erreur dans la console (F12)
- [ ] Aucune erreur 502 dans les requêtes réseau (onglet Network)

**Si la liste déroulante est vide** :
1. Ouvrir la console du navigateur (F12)
2. Aller dans l'onglet "Console" et vérifier les erreurs
3. Aller dans l'onglet "Network" et vérifier les requêtes vers `/api/admin/organizations`
4. Vérifier que vous avez le rôle ADMIN dans Keycloak

#### 3.2 Page Tableau de bord (User)

**URL** : https://www.hscode.enclume-numerique.com/dashboard

**Vérifications** :
- [ ] La page se charge sans erreur
- [ ] Les informations de l'organisation s'affichent
- [ ] Les statistiques personnelles s'affichent
- [ ] Les graphiques s'affichent correctement
- [ ] Aucune erreur dans la console (F12)
- [ ] Aucune erreur 502 dans les requêtes réseau

#### 3.3 Page Alertes

**URL** : https://www.hscode.enclume-numerique.com/alerts

**Vérifications** :
- [ ] La page se charge sans erreur
- [ ] Les alertes s'affichent (ou message "Aucune alerte")
- [ ] Le badge d'alertes dans la navbar affiche le bon nombre
- [ ] Aucune erreur dans la console (F12)
- [ ] Aucune erreur 502 dans les requêtes réseau

#### 3.4 Page Organisations (Admin)

**URL** : https://www.hscode.enclume-numerique.com/admin/organizations

**Vérifications** :
- [ ] La page se charge sans erreur
- [ ] La liste des organisations s'affiche
- [ ] La création d'organisation fonctionne
- [ ] La modification d'organisation fonctionne
- [ ] La gestion des utilisateurs fonctionne
- [ ] La gestion des quotas fonctionne
- [ ] Aucune erreur dans la console (F12)

### Étape 4 : Vérifier les Endpoints Protégés

#### 4.1 Obtenir un Token JWT

**Méthode 1 : Depuis le Navigateur**
1. Ouvrir https://www.hscode.enclume-numerique.com
2. Se connecter avec vos identifiants
3. Ouvrir la console du navigateur (F12)
4. Aller dans l'onglet "Application" > "Storage" > "Local Storage"
5. Chercher le token JWT (généralement stocké par Keycloak)

**Méthode 2 : Depuis les Requêtes Réseau**
1. Ouvrir la console du navigateur (F12)
2. Aller dans l'onglet "Network"
3. Effectuer une requête (ex: charger la page Stats)
4. Cliquer sur la requête vers `/api/admin/organizations`
5. Voir les headers de la requête
6. Copier le token depuis le header `Authorization: Bearer <token>`

#### 4.2 Tester les Endpoints

```bash
# Tester l'endpoint des organisations (remplacer <token> par votre token)
curl -X GET \
  https://www.hscode.enclume-numerique.com/api/admin/organizations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"

# Tester l'endpoint des statistiques utilisateur
curl -X GET \
  https://www.hscode.enclume-numerique.com/api/user/usage/stats \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"

# Tester l'endpoint du quota
curl -X GET \
  https://www.hscode.enclume-numerique.com/api/user/quota \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"

# Tester l'endpoint des alertes
curl -X GET \
  https://www.hscode.enclume-numerique.com/api/alerts/my-alerts/count \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

### Étape 5 : Vérifier la Base de Données

```bash
# Se connecter à la base de données
docker exec -it <container-app-db> psql -U muhend -d <POSTGRES_DB>

# Vérifier les tables
\dt

# Vérifier les organisations
SELECT * FROM organization;

# Vérifier les logs d'utilisation
SELECT COUNT(*) FROM usage_log;

# Vérifier les alertes
SELECT COUNT(*) FROM quota_alert;
```

## 🔧 Résolution des Problèmes

### Problème 1 : Liste déroulante des organisations vide

**Symptôme** : La liste déroulante ne contient que "Toutes".

**Diagnostic** :
1. Ouvrir la console du navigateur (F12)
2. Aller dans l'onglet "Console" et vérifier les erreurs
3. Aller dans l'onglet "Network" et vérifier les requêtes vers `/api/admin/organizations`
4. Vérifier le statut HTTP de la réponse (200, 401, 403, 502, etc.)

**Solutions** :
- **Si 401/403** : Vérifier que vous avez le rôle ADMIN dans Keycloak
- **Si 502** : Vérifier que le backend est en cours d'exécution
- **Si 200 mais liste vide** : Créer des organisations depuis la page "Organisations"

### Problème 2 : Erreurs 502 Bad Gateway

**Symptôme** : Les requêtes retournent 502.

**Solutions** :
1. Vérifier que le backend est en cours d'exécution : `docker ps | grep backend`
2. Vérifier les logs : `docker logs hscode-backend --tail 100`
3. Vérifier que le backend démarre correctement
4. Redémarrer le backend si nécessaire

### Problème 3 : Erreurs "Http failure during parsing"

**Symptôme** : Les requêtes retournent du HTML au lieu de JSON.

**Solutions** :
1. Vérifier que le backend est en cours d'exécution
2. Vérifier la configuration Traefik
3. Vérifier que les routes sont correctement configurées

## 📊 Checklist de Vérification

### Backend
- [x] Backend démarre sans erreur (selon vous)
- [ ] Endpoint `/api/health` répond correctement
- [ ] Endpoint `/api/admin/organizations` répond correctement
- [ ] Endpoint `/api/user/usage/stats` répond correctement
- [ ] Endpoint `/api/user/quota` répond correctement
- [ ] Endpoint `/api/alerts/my-alerts/count` répond correctement
- [ ] Aucune erreur dans les logs du backend

### Frontend
- [ ] Page Stats charge les organisations
- [ ] Page Stats affiche les statistiques
- [ ] Page Stats affiche les graphiques
- [ ] Page Dashboard affiche les informations
- [ ] Page Dashboard affiche les statistiques
- [ ] Page Dashboard affiche les graphiques
- [ ] Page Alertes affiche les alertes
- [ ] Badge d'alertes dans la navbar fonctionne
- [ ] Page Organisations fonctionne correctement
- [ ] Aucune erreur dans la console du navigateur
- [ ] Aucune erreur 502 dans les requêtes réseau

### Base de Données
- [ ] Base de données accessible
- [ ] Tables existent (usage_log, organization, organization_user, quota_alert)
- [ ] Données correctement stockées
- [ ] Requêtes fonctionnent correctement

## 🎯 Actions Immédiates

1. **Tester l'endpoint de santé** :
   ```bash
   curl -k https://www.hscode.enclume-numerique.com/api/health
   ```

2. **Vérifier dans le navigateur** :
   - Ouvrir la page Stats
   - Vérifier que les organisations se chargent
   - Vérifier la console (F12) pour les erreurs

3. **Si des problèmes persistent** :
   - Vérifier les logs du backend
   - Vérifier la console du navigateur
   - Vérifier les requêtes réseau dans l'onglet Network

## 📝 Documentation

- **VERIFICATION_POST_DEMARRAGE.md** : Guide de vérification après démarrage
- **TEST_ENDPOINTS.md** : Guide de test des endpoints
- **ACTIONS_IMMEDIATES.md** : Guide des actions immédiates
- **RESUME_ETAT_ACTUEL.md** : Résumé de l'état actuel

## 🎉 Résultat Attendu

Une fois toutes les vérifications terminées :
- ✅ Le backend démarre correctement
- ✅ Les endpoints répondent correctement
- ✅ Les pages web fonctionnent sans erreurs
- ✅ Les organisations se chargent dans la liste déroulante
- ✅ Les statistiques s'affichent correctement
- ✅ Les alertes se chargent sans erreur

---

**Dernière mise à jour** : Après vérification que le backend démarre correctement

