# 🔍 Diagnostic - Erreurs 502 Bad Gateway et Backend Inaccessible

## ❌ Problèmes Identifiés

1. **502 Bad Gateway** pour `/api/alerts/my-alerts/count`
2. **Http failure during parsing** pour `/api/user/usage/stats` et `/api/user/quota`
3. **Liste déroulante des organisations vide** dans Stats

## 🔍 Cause Racine

Le backend **n'est pas en cours d'exécution**. C'est pour cela que :
- Les requêtes retournent 502 Bad Gateway (Traefik ne peut pas router vers le backend)
- Les requêtes sont parfois routées vers le frontend (qui retourne du HTML au lieu de JSON)

## 🚨 Actions Immédiates

### 1. Vérifier l'état du backend

```bash
# Vérifier tous les conteneurs
docker ps -a

# Vérifier spécifiquement le backend
docker ps -a --filter "name=backend"

# Vérifier avec Docker Compose
docker-compose -f docker-compose-prod.yml ps backend
```

### 2. Vérifier les logs du backend

```bash
# Voir les logs du backend
docker logs <container-backend> --tail 100

# Ou avec Docker Compose
docker-compose -f docker-compose-prod.yml logs backend --tail 100

# Suivre les logs en temps réel
docker-compose -f docker-compose-prod.yml logs -f backend
```

### 3. Démarrer le backend

```bash
# Démarrer le backend
docker-compose -f docker-compose-prod.yml up -d backend

# Ou redémarrer toute la stack
docker-compose -f docker-compose-prod.yml restart backend

# Ou reconstruire et démarrer
docker-compose -f docker-compose-prod.yml up -d --build backend
```

### 4. Vérifier les dépendances

Le backend dépend de :
- **app-db** (PostgreSQL) : doit être `healthy`
- **keycloak** : doit être `started`

```bash
# Vérifier l'état des dépendances
docker-compose -f docker-compose-prod.yml ps app-db keycloak

# Vérifier les logs de la base de données
docker-compose -f docker-compose-prod.yml logs app-db --tail 50
```

## 🔧 Causes Possibles

### 1. Backend crash au démarrage

Le backend peut crasher à cause de :
- **Erreur de configuration** : variables d'environnement manquantes
- **Erreur de connexion à la base de données** : credentials incorrects, base de données non accessible
- **Erreur de connexion à Keycloak** : URL incorrecte, credentials incorrects
- **Erreur de compilation** : code Java non compilable
- **Port déjà utilisé** : le port 8081 est déjà utilisé
- **Mémoire insuffisante** : le conteneur n'a pas assez de mémoire

### 2. Backend non démarré

Le backend peut ne pas démarrer à cause de :
- **Docker Compose down** : la stack a été arrêtée
- **Conteneur supprimé** : le conteneur a été supprimé
- **Erreur de build** : l'image Docker n'a pas pu être construite

### 3. Problème de réseau Docker

Le backend peut ne pas être accessible à cause de :
- **Réseau Docker non créé** : le réseau `webproxy` n'existe pas
- **Réseau mal configuré** : le backend n'est pas sur le bon réseau
- **Traefik non accessible** : Traefik ne peut pas atteindre le backend

## 📋 Checklist de Diagnostic

- [ ] Le backend est-il en cours d'exécution ? (`docker ps | grep backend`)
- [ ] Les logs du backend montrent-ils des erreurs ?
- [ ] La base de données est-elle accessible ? (`docker ps | grep app-db`)
- [ ] Keycloak est-il accessible ? (`docker ps | grep keycloak`)
- [ ] Le réseau Docker `webproxy` existe-t-il ? (`docker network ls | grep webproxy`)
- [ ] Le backend peut-il se connecter à la base de données ?
- [ ] Le backend peut-il se connecter à Keycloak ?
- [ ] Le port 8081 est-il disponible ?
- [ ] Les variables d'environnement sont-elles correctes ?

## 🛠️ Solutions

### Solution 1 : Redémarrer le backend

```bash
# Redémarrer le backend
docker-compose -f docker-compose-prod.yml restart backend

# Vérifier qu'il démarre correctement
docker-compose -f docker-compose-prod.yml logs -f backend
```

### Solution 2 : Reconstruire et redémarrer

```bash
# Reconstruire l'image et redémarrer
docker-compose -f docker-compose-prod.yml up -d --build backend

# Vérifier les logs
docker-compose -f docker-compose-prod.yml logs -f backend
```

### Solution 3 : Redémarrer toute la stack

```bash
# Arrêter toute la stack
docker-compose -f docker-compose-prod.yml down

# Redémarrer toute la stack
docker-compose -f docker-compose-prod.yml up -d

# Vérifier l'état
docker-compose -f docker-compose-prod.yml ps
```

### Solution 4 : Vérifier les logs et corriger les erreurs

```bash
# Voir les logs du backend
docker-compose -f docker-compose-prod.yml logs backend --tail 200

# Chercher les erreurs
docker-compose -f docker-compose-prod.yml logs backend | grep -i error

# Chercher les exceptions
docker-compose -f docker-compose-prod.yml logs backend | grep -i exception
```

## 🧪 Tests Après Redémarrage

### 1. Tester l'endpoint de santé

```bash
curl -k https://www.hscode.enclume-numerique.com/api/health
```

**Résultat attendu** : `{"status":"UP","service":"backend","message":"Backend is running"}`

### 2. Tester un endpoint protégé

```bash
# Avec un token JWT valide
curl -X GET \
  https://www.hscode.enclume-numerique.com/api/user/quota \
  -H "Authorization: Bearer <token>"
```

**Résultat attendu** : JSON avec les informations de quota

### 3. Vérifier dans le navigateur

- Ouvrir la page "Stats" : les organisations devraient se charger
- Ouvrir la page "Tableau de bord" : les statistiques devraient s'afficher
- Vérifier la console du navigateur : aucune erreur 502

## 📝 Notes

- Le backend doit être sur le réseau `webproxy` pour être accessible par Traefik
- Le backend doit être sur le réseau `default` pour accéder à la base de données et à Keycloak
- Le backend écoute sur le port 8081 (interne au conteneur)
- Traefik route les requêtes `/api/*` vers le backend après avoir enlevé le préfixe `/api`

## 🔄 Prochaines Étapes

1. ✅ **Vérifier l'état du backend** avec `docker ps -a`
2. ✅ **Vérifier les logs** avec `docker logs <container-backend>`
3. ✅ **Démarrer le backend** avec `docker-compose -f docker-compose-prod.yml up -d backend`
4. ✅ **Vérifier les dépendances** (base de données, Keycloak)
5. ✅ **Tester l'endpoint de santé** pour confirmer que le backend répond
6. ✅ **Vérifier dans le navigateur** que les pages fonctionnent

---

**Dernière mise à jour** : Après identification du problème de backend non démarré

