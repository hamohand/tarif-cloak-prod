# 🔍 Test de Connexion Backend

## 🎯 Objectif

Vérifier que le backend répond correctement et que Traefik peut le joindre.

## 📋 Étapes de Diagnostic

### 1. Vérifier que le backend est démarré

```bash
# Vérifier les conteneurs
docker compose ps

# Le backend doit être "Up" et "healthy" (si healthcheck configuré)
```

### 2. Tester l'endpoint de santé directement

```bash
# Depuis l'intérieur du conteneur backend
docker compose exec backend curl http://localhost:8081/health

# Réponse attendue :
# {"status":"UP","service":"backend","message":"Backend is running"}
```

### 3. Tester depuis l'extérieur (si les ports sont exposés)

```bash
# Si le port 8081 est exposé
curl http://localhost:8081/health
```

### 4. Tester via Traefik

```bash
# Test via Traefik (nécessite d'être sur le serveur ou via un tunnel)
curl https://www.hscode.enclume-numerique.com/api/health

# Réponse attendue :
# {"status":"UP","service":"backend","message":"Backend is running"}
```

### 5. Vérifier les logs du backend

```bash
# Vérifier les logs
docker compose logs backend --tail=100

# Chercher :
# - "Backend Application Started -port:8081-"
# - Erreurs de démarrage
# - Erreurs de connexion à la base de données
```

### 6. Vérifier la configuration Traefik

```bash
# Vérifier que Traefik voit le backend
docker compose exec traefik wget -qO- http://localhost:8080/api/http/routers | grep -i backend

# Vérifier les services
docker compose exec traefik wget -qO- http://localhost:8080/api/http/services | grep -i backend
```

## 🔧 Solutions selon le résultat

### Si `/health` ne répond pas depuis le conteneur

**Problème** : Le backend ne démarre pas ou crash.

**Solution** :
1. Vérifier les logs : `docker compose logs backend`
2. Vérifier les erreurs de démarrage
3. Vérifier que la table `usage_log` est créée (ou que `ddl-auto=update` est actif)

### Si `/health` répond depuis le conteneur mais pas via Traefik

**Problème** : Configuration Traefik incorrecte ou backend non dans le réseau Traefik.

**Solution** :
1. Vérifier que le backend est dans le réseau `webproxy` :
   ```bash
   docker compose exec backend ping traefik
   ```

2. Vérifier les labels Traefik dans `docker-compose-prod.yml`

3. Redémarrer Traefik :
   ```bash
   docker compose restart traefik
   ```

### Si `/health` répond mais `/api/recherche/positions6` ne fonctionne pas

**Problème** : Problème d'authentification ou de routage spécifique.

**Solution** :
1. Vérifier que le token JWT est valide
2. Vérifier les logs du backend pour les erreurs 401/403
3. Vérifier la configuration Spring Security

## ✅ Vérification Finale

Une fois que `/health` répond via Traefik :

```bash
# Test de santé
curl https://www.hscode.enclume-numerique.com/api/health

# Test de recherche (nécessite un token valide)
curl -H "Authorization: Bearer <token>" \
  "https://www.hscode.enclume-numerique.com/api/recherche/positions6?termeRecherche=figues"
```

## 🚨 Commandes de Diagnostic Rapide

```bash
# 1. Vérifier les conteneurs
docker compose ps

# 2. Logs du backend
docker compose logs backend --tail=50

# 3. Test de santé interne
docker compose exec backend curl http://localhost:8081/health

# 4. Vérifier le réseau
docker compose exec backend ping -c 2 traefik

# 5. Redémarrer le backend
docker compose restart backend

# 6. Vérifier les logs après redémarrage
docker compose logs -f backend
```

