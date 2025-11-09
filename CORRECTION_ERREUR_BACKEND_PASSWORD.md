# 🔧 Correction - Erreur d'authentification PostgreSQL

## ❌ Problème Identifié

Le backend crash au démarrage avec l'erreur :
```
FATAL: password authentication failed for user "muhend"
```

## 🔍 Cause

Le backend ne peut pas se connecter à la base de données PostgreSQL car :
- Le mot de passe est incorrect
- Les variables d'environnement ne sont pas correctement définies
- Les credentials dans `docker-compose-prod.yml` ne correspondent pas à ceux de la base de données

## 🚨 Solution Immédiate

### 1. Vérifier les variables d'environnement

Vérifier que le fichier `.env` contient les bonnes valeurs pour :
- `POSTGRES_USER=muhend` (ou le nom d'utilisateur correct)
- `POSTGRES_PASSWORD=<mot de passe correct>`
- `POSTGRES_DB=<nom de la base de données>`

### 2. Vérifier la configuration du backend

Dans `docker-compose-prod.yml`, le backend utilise :
```yaml
environment:
  POSTGRES_USER: "${POSTGRES_USER}"
  POSTGRES_PASSWORD: "${POSTGRES_PASSWORD}"
  POSTGRES_DB: "${POSTGRES_DB}"
```

Ces variables doivent correspondre aux credentials de la base de données.

### 3. Vérifier la configuration Spring Boot

Dans `backend/src/main/resources/application.yml`, la configuration de la base de données utilise :
```yaml
spring:
  datasource:
    url: jdbc:postgresql://${DB_SERVICE_NAME}:${POSTGRES_PORT}/${POSTGRES_DB}
    username: ${POSTGRES_USER}
    password: ${POSTGRES_PASSWORD}
```

### 4. Vérifier que la base de données est accessible

```bash
# Vérifier que la base de données est en cours d'exécution
docker ps | grep app-db

# Vérifier les logs de la base de données
docker logs <container-app-db> --tail 50
```

### 5. Tester la connexion à la base de données

```bash
# Se connecter à la base de données avec les credentials
docker exec -it <container-app-db> psql -U muhend -d <POSTGRES_DB>

# Si cela échoue, vérifier les credentials dans le conteneur
docker exec -it <container-app-db> env | grep POSTGRES
```

## 🛠️ Actions Correctives

### Option 1 : Corriger les variables d'environnement

1. Modifier le fichier `.env` avec les bons credentials
2. Redémarrer le backend :
```bash
docker-compose -f docker-compose-prod.yml restart backend
```

### Option 2 : Réinitialiser la base de données

Si les credentials ont changé, il peut être nécessaire de réinitialiser la base de données :

```bash
# Arrêter les conteneurs
docker-compose -f docker-compose-prod.yml down

# Supprimer le volume de la base de données (⚠️ ATTENTION : cela supprimera toutes les données)
docker volume rm <volume-name>

# Redémarrer avec les nouveaux credentials
docker-compose -f docker-compose-prod.yml up -d
```

### Option 3 : Vérifier les credentials dans Keycloak

Si la base de données utilise des credentials différents pour Keycloak, vérifier que :
- La base de données Keycloak utilise les bons credentials
- Les variables d'environnement Keycloak sont correctes

## 📋 Checklist

- [ ] Le fichier `.env` contient les bons credentials
- [ ] Les variables d'environnement sont correctement définies
- [ ] La base de données est en cours d'exécution
- [ ] Les credentials correspondent entre `docker-compose-prod.yml` et la base de données
- [ ] La configuration Spring Boot utilise les bonnes variables d'environnement
- [ ] Le backend peut se connecter à la base de données

## 🔄 Prochaines Étapes

1. ✅ **Vérifier le fichier `.env`** et corriger les credentials si nécessaire
2. ✅ **Vérifier que la base de données est accessible**
3. ✅ **Redémarrer le backend** avec les bons credentials
4. ✅ **Vérifier les logs** pour confirmer que la connexion réussit
5. ✅ **Tester l'endpoint de santé** pour confirmer que le backend fonctionne

## 💡 Notes

- Les credentials PostgreSQL sont sensibles et doivent être stockés de manière sécurisée
- Ne jamais commiter le fichier `.env` dans le dépôt Git
- Utiliser des variables d'environnement ou un gestionnaire de secrets pour la production
- Vérifier régulièrement que les credentials sont corrects après les mises à jour

---

**Dernière mise à jour** : Après identification de l'erreur d'authentification PostgreSQL

