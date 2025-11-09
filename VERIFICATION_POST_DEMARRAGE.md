# ✅ Vérification Post-Démarrage - Backend Fonctionnel

## 🎉 État Actuel

✅ **Backend démarre correctement** - Aucune erreur

## 📋 Étapes de Vérification

### 1. Vérifier l'Endpoint de Santé

**Test** : Vérifier que l'endpoint de santé répond correctement.

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

### 2. Vérifier les Endpoints Protégés

#### 2.1 Tester l'endpoint des organisations (admin)

**Test** : Vérifier que l'endpoint des organisations répond correctement.

```bash
# Obtenir un token JWT depuis le frontend (connectez-vous d'abord)
# Puis tester l'endpoint
curl -X GET \
  https://www.hscode.enclume-numerique.com/api/admin/organizations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**Résultat attendu** : Liste des organisations en JSON

#### 2.2 Tester l'endpoint des statistiques utilisateur

**Test** : Vérifier que l'endpoint des statistiques utilisateur répond.

```bash
curl -X GET \
  https://www.hscode.enclume-numerique.com/api/user/usage/stats \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**Résultat attendu** : Statistiques d'utilisation en JSON

#### 2.3 Tester l'endpoint du quota utilisateur

**Test** : Vérifier que l'endpoint du quota répond.

```bash
curl -X GET \
  https://www.hscode.enclume-numerique.com/api/user/quota \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**Résultat attendu** : Informations de quota en JSON

#### 2.4 Tester l'endpoint des alertes

**Test** : Vérifier que l'endpoint des alertes répond.

```bash
curl -X GET \
  https://www.hscode.enclume-numerique.com/api/alerts/my-alerts/count \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**Résultat attendu** : `{"count": 0}` ou `{"count": <nombre>}`

### 3. Vérifier dans le Navigateur

#### 3.1 Page Stats (Admin)

**URL** : https://www.hscode.enclume-numerique.com/admin/stats

**Vérifications** :
- [ ] La page se charge sans erreur
- [ ] La liste déroulante des organisations contient les organisations (pas seulement "Toutes")
- [ ] Les statistiques s'affichent correctement
- [ ] Les graphiques s'affichent correctement
- [ ] Aucune erreur dans la console (F12)
- [ ] Aucune erreur 502 dans les requêtes réseau

**Si la liste déroulante est vide** :
1. Vérifier que vous avez le rôle ADMIN
2. Vérifier la console du navigateur (F12) pour les erreurs
3. Vérifier les logs du backend pour les erreurs

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

### 4. Vérifier les Logs du Backend

**Vérifications** :
- [ ] Aucune erreur dans les logs
- [ ] Les requêtes sont bien traitées
- [ ] Les connexions à la base de données fonctionnent

```bash
# Voir les dernières lignes des logs
docker logs hscode-backend --tail 50

# Suivre les logs en temps réel
docker logs -f hscode-backend
```

### 5. Vérifier la Base de Données

**Vérifications** :
- [ ] La base de données est accessible
- [ ] Les tables existent (usage_log, organization, organization_user, quota_alert)
- [ ] Les données sont correctement stockées

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

## 🔧 Résolution des Problèmes Restants

### Problème 1 : Liste déroulante des organisations vide

**Symptôme** : La liste déroulante ne contient que "Toutes".

**Causes possibles** :
1. L'utilisateur n'a pas le rôle ADMIN
2. Aucune organisation dans la base de données
3. Erreur lors du chargement des organisations

**Solution** :
1. Vérifier que vous avez le rôle ADMIN dans Keycloak
2. Vérifier la console du navigateur (F12) pour les erreurs
3. Créer des organisations depuis la page "Organisations"
4. Vérifier les logs du backend pour les erreurs

### Problème 2 : Erreurs 502 Bad Gateway

**Symptôme** : Les requêtes retournent 502.

**Causes possibles** :
1. Le backend n'est pas en cours d'exécution
2. Traefik ne peut pas router vers le backend
3. Le réseau Docker n'est pas correctement configuré

**Solution** :
1. Vérifier que le backend est en cours d'exécution : `docker ps | grep backend`
2. Vérifier les logs de Traefik
3. Vérifier que le réseau Docker `webproxy` existe
4. Redémarrer le backend si nécessaire

### Problème 3 : Erreurs 401/403

**Symptôme** : Les requêtes retournent 401 ou 403.

**Causes possibles** :
1. Le token JWT est invalide ou expiré
2. L'utilisateur n'a pas les bons rôles
3. Keycloak n'est pas accessible

**Solution** :
1. Se reconnecter pour obtenir un nouveau token
2. Vérifier que l'utilisateur a les bons rôles dans Keycloak
3. Vérifier que Keycloak est accessible

### Problème 4 : Erreurs "Http failure during parsing"

**Symptôme** : Les requêtes retournent du HTML au lieu de JSON.

**Causes possibles** :
1. La requête est routée vers le frontend au lieu du backend
2. Traefik ne route pas correctement

**Solution** :
1. Vérifier que le backend est en cours d'exécution
2. Vérifier la configuration Traefik
3. Vérifier que les routes sont correctement configurées

## 📊 Checklist de Vérification Complète

### Backend
- [x] Backend démarre sans erreur
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

## 🎯 Prochaines Étapes

Une fois toutes les vérifications terminées :

1. **Tester toutes les fonctionnalités** :
   - Créer une organisation
   - Ajouter des utilisateurs à une organisation
   - Définir un quota pour une organisation
   - Effectuer des recherches (pour générer des logs d'utilisation)
   - Vérifier que les alertes se génèrent

2. **Vérifier les performances** :
   - Tester les performances des endpoints
   - Vérifier que les index de performance sont appliqués
   - Vérifier que le cache fonctionne

3. **Documenter** :
   - Documenter les fonctionnalités
   - Documenter les endpoints
   - Documenter les procédures de dépannage

## 📝 Notes

- Le backend est maintenant fonctionnel ✅
- Les endpoints devraient répondre correctement
- Les pages web devraient fonctionner sans erreurs
- Si des problèmes persistent, consulter les logs et la console du navigateur

---

**Dernière mise à jour** : Après vérification que le backend démarre correctement

