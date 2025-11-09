# 📋 Étapes Suivantes - Résolution des Problèmes Backend

## 🎯 Objectif

Faire démarrer le backend correctement et résoudre tous les problèmes identifiés.

## 📊 État Actuel

✅ **Corrigé** : Erreur YAML (clé `spring` dupliquée)
❌ **À corriger** : Erreur d'authentification PostgreSQL
❌ **À vérifier** : Backend démarre correctement
❌ **À tester** : Endpoints accessibles

## 🚀 Étapes à Suivre

### Étape 1 : Vérifier les Variables d'Environnement

#### 1.1 Vérifier le fichier `.env`

```bash
# Vérifier que le fichier .env existe
cat .env

# Vérifier les variables PostgreSQL
grep POSTGRES .env
```

**Variables requises** :
```bash
POSTGRES_USER=muhend
POSTGRES_PASSWORD=<mot de passe correct>
POSTGRES_DB=<nom de la base de données>
```

#### 1.2 Vérifier les credentials dans Docker Compose

```bash
# Vérifier la configuration dans docker-compose-prod.yml
grep -A 5 "common-app-bd-vars" docker-compose-prod.yml
```

### Étape 2 : Vérifier l'État de la Base de Données

#### 2.1 Vérifier que la base de données est en cours d'exécution

```bash
# Vérifier les conteneurs PostgreSQL
docker ps | grep -E "app-db|postgres"

# Vérifier l'état de la base de données
docker-compose -f docker-compose-prod.yml ps app-db
```

#### 2.2 Vérifier les logs de la base de données

```bash
# Voir les logs de la base de données
docker logs <container-app-db> --tail 50

# Vérifier qu'il n'y a pas d'erreurs
docker logs <container-app-db> --tail 50 | grep -i error
```

#### 2.3 Tester la connexion à la base de données

```bash
# Se connecter à la base de données
docker exec -it <container-app-db> psql -U muhend -d <POSTGRES_DB>

# Si cela échoue, vérifier les credentials
docker exec -it <container-app-db> env | grep POSTGRES
```

### Étape 3 : Corriger les Credentials si Nécessaire

#### 3.1 Si les credentials sont incorrects

**Option A : Corriger le fichier `.env`**

1. Ouvrir le fichier `.env`
2. Corriger les valeurs de `POSTGRES_USER`, `POSTGRES_PASSWORD`, et `POSTGRES_DB`
3. Sauvegarder le fichier

**Option B : Réinitialiser la base de données (⚠️ ATTENTION : supprime les données)**

```bash
# Arrêter les conteneurs
docker-compose -f docker-compose-prod.yml down

# Supprimer le volume de la base de données
docker volume ls | grep app-database-data
docker volume rm <volume-name>

# Redémarrer avec les nouveaux credentials
docker-compose -f docker-compose-prod.yml up -d app-db

# Attendre que la base de données soit prête
docker-compose -f docker-compose-prod.yml ps app-db
```

### Étape 4 : Redémarrer le Backend

#### 4.1 Arrêter le backend (s'il est en cours d'exécution)

```bash
# Arrêter le backend
docker-compose -f docker-compose-prod.yml stop backend

# Vérifier qu'il est arrêté
docker ps | grep backend
```

#### 4.2 Redémarrer le backend

```bash
# Redémarrer le backend
docker-compose -f docker-compose-prod.yml up -d backend

# Ou reconstruire et redémarrer
docker-compose -f docker-compose-prod.yml up -d --build backend
```

#### 4.3 Vérifier les logs du backend

```bash
# Suivre les logs en temps réel
docker logs -f hscode-backend

# Ou voir les dernières lignes
docker logs hscode-backend --tail 100

# Vérifier qu'il n'y a pas d'erreurs
docker logs hscode-backend --tail 100 | grep -i error
```

### Étape 5 : Vérifier que le Backend Démarre Correctement

#### 5.1 Vérifier l'état du conteneur

```bash
# Vérifier que le backend est en cours d'exécution
docker ps | grep backend

# Vérifier l'état détaillé
docker-compose -f docker-compose-prod.yml ps backend
```

#### 5.2 Vérifier les logs de démarrage

**Signes de succès** :
- `Backend Application Started -port:8081-`
- `Started BackendApplication in X seconds`
- Pas d'erreurs `FATAL` ou `Exception`

**Signes d'échec** :
- `FATAL: password authentication failed`
- `Unable to create requested service`
- `Application run failed`

### Étape 6 : Tester les Endpoints

#### 6.1 Tester l'endpoint de santé (public)

```bash
# Tester l'endpoint de santé
curl -k https://www.hscode.enclume-numerique.com/api/health

# Résultat attendu :
# {"status":"UP","service":"backend","message":"Backend is running"}
```

#### 6.2 Tester un endpoint protégé (avec authentification)

```bash
# Obtenir un token JWT (depuis Keycloak ou le frontend)
# Puis tester un endpoint
curl -X GET \
  https://www.hscode.enclume-numerique.com/api/user/quota \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

#### 6.3 Tester l'endpoint des organisations (admin)

```bash
# Tester l'endpoint des organisations (nécessite le rôle ADMIN)
curl -X GET \
  https://www.hscode.enclume-numerique.com/api/admin/organizations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

### Étape 7 : Vérifier dans le Navigateur

#### 7.1 Vérifier la page Stats

1. Ouvrir https://www.hscode.enclume-numerique.com/admin/stats
2. Vérifier que les organisations se chargent dans la liste déroulante
3. Vérifier qu'il n'y a pas d'erreurs dans la console (F12)

#### 7.2 Vérifier la page Tableau de bord

1. Ouvrir https://www.hscode.enclume-numerique.com/dashboard
2. Vérifier que les statistiques s'affichent
3. Vérifier qu'il n'y a pas d'erreurs dans la console

#### 7.3 Vérifier les alertes

1. Vérifier que le badge d'alertes se charge dans la navbar
2. Ouvrir la page des alertes
3. Vérifier qu'il n'y a pas d'erreurs 502

### Étape 8 : Résoudre les Problèmes Restants

#### 8.1 Si le backend ne démarre pas

**Vérifier les logs** :
```bash
docker logs hscode-backend --tail 100
```

**Causes possibles** :
- Credentials PostgreSQL incorrects
- Base de données non accessible
- Port 8081 déjà utilisé
- Variables d'environnement manquantes

#### 8.2 Si les endpoints retournent 502

**Vérifier** :
- Le backend est en cours d'exécution
- Traefik peut router vers le backend
- Le réseau Docker est correctement configuré

#### 8.3 Si les endpoints retournent 401/403

**Vérifier** :
- Le token JWT est valide
- L'utilisateur a les bons rôles (USER, ADMIN)
- Keycloak est accessible

## 📋 Checklist de Vérification

- [ ] Le fichier `.env` contient les bons credentials PostgreSQL
- [ ] La base de données est en cours d'exécution
- [ ] Les credentials correspondent entre `.env` et `docker-compose-prod.yml`
- [ ] Le backend peut se connecter à la base de données
- [ ] Le backend démarre sans erreur
- [ ] L'endpoint `/api/health` répond correctement
- [ ] Les endpoints protégés fonctionnent avec un token JWT valide
- [ ] La page Stats charge les organisations
- [ ] La page Tableau de bord affiche les statistiques
- [ ] Les alertes se chargent correctement
- [ ] Aucune erreur 502 dans le navigateur

## 🔧 Commandes Utiles

### Vérifier l'état des conteneurs

```bash
# Voir tous les conteneurs
docker ps -a

# Voir les conteneurs en cours d'exécution
docker ps

# Voir l'état avec Docker Compose
docker-compose -f docker-compose-prod.yml ps
```

### Vérifier les logs

```bash
# Logs du backend
docker logs hscode-backend --tail 100

# Logs de la base de données
docker logs <container-app-db> --tail 50

# Logs de Keycloak
docker logs <container-keycloak> --tail 50
```

### Redémarrer les services

```bash
# Redémarrer le backend
docker-compose -f docker-compose-prod.yml restart backend

# Redémarrer toute la stack
docker-compose -f docker-compose-prod.yml restart

# Reconstruire et redémarrer
docker-compose -f docker-compose-prod.yml up -d --build
```

### Tester les endpoints

```bash
# Endpoint de santé
curl -k https://www.hscode.enclume-numerique.com/api/health

# Endpoint avec authentification
curl -X GET \
  https://www.hscode.enclume-numerique.com/api/user/quota \
  -H "Authorization: Bearer <token>"
```

## 📝 Notes Importantes

- **Ne jamais commiter le fichier `.env`** dans le dépôt Git
- **Sauvegarder régulièrement la base de données** pour éviter la perte de données
- **Vérifier les logs régulièrement** pour détecter les problèmes
- **Tester les endpoints après chaque modification** pour s'assurer que tout fonctionne

## 🎯 Résultat Attendu

Une fois toutes les étapes terminées :
- ✅ Le backend démarre correctement
- ✅ Les endpoints répondent correctement
- ✅ Les pages web fonctionnent sans erreurs
- ✅ Les organisations se chargent dans la liste déroulante
- ✅ Les statistiques s'affichent correctement
- ✅ Les alertes se chargent sans erreur

---

**Dernière mise à jour** : Après correction de l'erreur YAML

