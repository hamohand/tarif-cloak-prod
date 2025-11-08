# 🔍 Diagnostic : Problème de Routage Traefik

## 🎯 Problème

L'endpoint `/api/recherche/positions6` retourne du HTML (page Angular) au lieu de JSON, ce qui signifie que Traefik route vers le frontend au lieu du backend.

## ✅ Corrections Apportées

### 1. Priorité des Routes Traefik

Ajout de priorités explicites dans `docker-compose-prod.yml` :
- **Backend** : `priority: 10` (priorité élevée pour `/api/**`)
- **Frontend** : `priority: 1` (priorité basse, catch-all)

Cela garantit que les routes `/api/**` sont toujours évaluées en premier.

### 2. Endpoint de Santé

Ajout d'un endpoint `/health` pour diagnostiquer si le backend répond :
- Accessible sans authentification
- Retourne `{"status":"UP","service":"backend","message":"Backend is running"}`

## 📋 Diagnostic Étape par Étape

### Étape 1 : Vérifier que le backend démarre

```bash
# Vérifier les logs du backend
docker compose logs backend --tail=100

# Chercher :
# - "Backend Application Started -port:8081-"
# - Erreurs de démarrage
# - "Table usage_log does not exist" (devrait être créée avec ddl-auto=update)
```

### Étape 2 : Tester l'endpoint de santé

```bash
# Depuis l'intérieur du conteneur backend
docker compose exec backend curl http://localhost:8081/health

# Réponse attendue :
# {"status":"UP","service":"backend","message":"Backend is running"}
```

### Étape 3 : Tester via Traefik

```bash
# Test de santé via Traefik
curl https://www.hscode.enclume-numerique.com/api/health

# Si ça retourne du JSON : le backend répond et Traefik route correctement
# Si ça retourne du HTML : problème de routage Traefik
```

### Étape 4 : Vérifier la configuration Traefik

```bash
# Vérifier que Traefik voit le backend
docker compose exec traefik wget -qO- http://localhost:8080/api/http/routers | grep -i backend

# Vérifier les services
docker compose exec traefik wget -qO- http://localhost:8080/api/http/services | grep -i backend

# Vérifier la priorité des routes
docker compose exec traefik wget -qO- http://localhost:8080/api/http/routers | jq '.[] | select(.name | contains("backend")) | {name, priority, rule}'
```

### Étape 5 : Vérifier que le backend est dans le réseau Traefik

```bash
# Vérifier la connectivité réseau
docker compose exec backend ping -c 2 traefik

# Vérifier les réseaux
docker network inspect webproxy | grep -A 5 backend
```

## 🔧 Actions Correctives

### Si le backend ne démarre pas

1. **Vérifier les logs** :
   ```bash
   docker compose logs backend
   ```

2. **Vérifier que la table est créée** :
   ```bash
   docker compose exec app-db psql -U muhend -d app-db -c "\dt usage_log"
   ```

3. **Redémarrer le backend** :
   ```bash
   docker compose restart backend
   ```

### Si le backend démarre mais ne répond pas

1. **Vérifier que le backend écoute sur le port 8081** :
   ```bash
   docker compose exec backend netstat -tlnp | grep 8081
   ```

2. **Tester directement depuis le conteneur** :
   ```bash
   docker compose exec backend curl http://localhost:8081/health
   ```

### Si Traefik ne route pas correctement

1. **Recharger la configuration Traefik** :
   ```bash
   # Redémarrer Traefik pour prendre en compte les nouvelles priorités
   docker compose restart traefik
   ```

2. **Vérifier les routes dans Traefik** :
   ```bash
   # Accéder au dashboard Traefik (si disponible)
   # Ou vérifier via l'API
   docker compose exec traefik wget -qO- http://localhost:8080/api/http/routers | jq
   ```

3. **Vérifier que les labels sont appliqués** :
   ```bash
   docker inspect <container-backend> | grep -i traefik
   ```

## 🚀 Après les Corrections

Une fois les corrections appliquées :

1. **Rebuilder le backend** (si nécessaire) :
   ```bash
   docker compose build backend
   ```

2. **Redémarrer les services** :
   ```bash
   docker compose restart backend traefik
   ```

3. **Tester l'endpoint de santé** :
   ```bash
   curl https://www.hscode.enclume-numerique.com/api/health
   ```

4. **Tester l'endpoint de recherche** :
   ```bash
   curl -H "Authorization: Bearer <token>" \
     "https://www.hscode.enclume-numerique.com/api/recherche/positions6?termeRecherche=figues"
   ```

## ⚠️ Points Importants

1. **Priorité des routes** : Le backend doit avoir une priorité plus élevée que le frontend pour `/api/**`
2. **Middleware stripprefix** : Traefik enlève `/api` avant d'envoyer au backend
3. **Réseau** : Le backend doit être dans le réseau `webproxy` pour que Traefik puisse le joindre
4. **Santé du backend** : Si le backend ne répond pas, Traefik peut faire un fallback vers le frontend

## ✅ Checklist de Vérification

- [ ] Le backend démarre sans erreur
- [ ] L'endpoint `/health` répond depuis le conteneur
- [ ] L'endpoint `/health` répond via Traefik
- [ ] Les priorités des routes sont correctes dans Traefik
- [ ] Le backend est dans le réseau `webproxy`
- [ ] Traefik peut joindre le backend
- [ ] L'endpoint de recherche retourne du JSON, pas du HTML

---

**Note** : Après avoir appliqué les corrections (priorités dans docker-compose-prod.yml), il faut redémarrer Traefik pour que les changements prennent effet.

