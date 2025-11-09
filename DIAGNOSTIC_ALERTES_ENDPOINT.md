# 🔍 Diagnostic - Endpoint `/api/alerts/my-alerts/count`

## ❌ Problème

L'endpoint `/api/alerts/my-alerts/count` retourne du HTML (page Angular) au lieu de JSON, ce qui signifie que la requête n'atteint pas le backend.

## 🔧 Corrections Appliquées

### 1. Ajout des annotations `@PreAuthorize("isAuthenticated()")`

J'ai ajouté les annotations `@PreAuthorize("isAuthenticated()")` sur tous les endpoints d'alertes pour garantir qu'ils nécessitent une authentification :

- ✅ `GET /alerts/my-alerts` 
- ✅ `GET /alerts/my-alerts/count`
- ✅ `PUT /alerts/{alertId}/read`
- ✅ `PUT /alerts/my-alerts/read-all`

## 🔍 Diagnostic

### Étape 1 : Vérifier que le backend est démarré

```bash
# Vérifier les conteneurs en cours d'exécution
docker ps | grep backend

# Vérifier les logs du backend
docker logs <container-backend> --tail 50

# Vérifier si le backend répond
curl -k https://www.hscode.enclume-numerique.com/api/health
```

**Résultat attendu** : Une réponse JSON comme `{"status":"UP","service":"backend","message":"Backend is running"}`

### Étape 2 : Vérifier le routage Traefik

```bash
# Vérifier les routes Traefik pour le backend
docker exec <container-traefik> traefik api --entrypoints=websecure

# Ou vérifier les logs Traefik
docker logs <container-traefik> --tail 100 | grep "backend\|alerts"
```

### Étape 3 : Vérifier la configuration Spring Security

L'endpoint `/alerts/my-alerts/count` devrait être protégé par la chaîne de sécurité protégée (Order 2) qui nécessite une authentification.

### Étape 4 : Tester l'endpoint directement

```bash
# Tester avec curl (remplacer <token> par un token JWT valide)
curl -X GET \
  https://www.hscode.enclume-numerique.com/api/alerts/my-alerts/count \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"

# Résultat attendu : {"count": 0} ou {"count": <nombre>}
```

## 🔧 Actions à Effectuer

### 1. Redémarrer le Backend

**IMPORTANT** : Le backend doit être redémarré pour que les modifications prennent effet.

```bash
# Redémarrer le backend
docker-compose -f docker-compose-prod.yml restart backend

# Ou reconstruire et redémarrer
docker-compose -f docker-compose-prod.yml up -d --build backend
```

### 2. Vérifier les Logs du Backend

```bash
# Suivre les logs en temps réel
docker logs -f <container-backend>

# Vérifier les erreurs
docker logs <container-backend> 2>&1 | grep -i error
```

### 3. Vérifier que l'Endpoint est Enregistré

Une fois le backend redémarré, vérifier que l'endpoint est bien enregistré :

```bash
# Accéder à Swagger UI
https://www.hscode.enclume-numerique.com/api/swagger-ui.html

# Ou vérifier les endpoints découverts
curl -k https://www.hscode.enclume-numerique.com/api/admin/endpoints \
  -H "Authorization: Bearer <token>"
```

### 4. Vérifier la Table `quota_alert`

```bash
# Se connecter à la base de données
docker exec -it <container-postgres> psql -U <user> -d <database>

# Vérifier que la table existe
\dt quota_alert

# Vérifier la structure
\d quota_alert
```

## 🐛 Causes Possibles

1. **Backend non démarré** : Le backend n'est pas en cours d'exécution
2. **Backend non redémarré** : Les modifications n'ont pas été prises en compte
3. **Routage Traefik incorrect** : Traefik ne route pas correctement vers le backend
4. **Erreur de compilation** : Le backend n'a pas pu compiler à cause d'une erreur
5. **Table manquante** : La table `quota_alert` n'existe pas dans la base de données
6. **Problème de sécurité** : Spring Security bloque la requête avant qu'elle n'atteigne le contrôleur

## ✅ Solution Recommandée

### 1. Vérifier et Redémarrer le Backend

```bash
# Arrêter le backend
docker-compose -f docker-compose-prod.yml stop backend

# Vérifier les logs pour les erreurs
docker logs <container-backend> --tail 100

# Redémarrer le backend
docker-compose -f docker-compose-prod.yml up -d backend

# Vérifier que le backend démarre correctement
docker logs -f <container-backend>
```

### 2. Vérifier la Configuration Traefik

Le fichier `docker-compose-prod.yml` devrait avoir :
- Priorité du backend : `priority: 10` (plus élevée que le frontend)
- Route backend : `PathPrefix(/api)`
- Middleware : `hscode-api-stripprefix` qui enlève le préfixe `/api`

### 3. Tester l'Endpoint de Santé

```bash
# Tester l'endpoint de santé (public, pas besoin d'authentification)
curl -k https://www.hscode.enclume-numerique.com/api/health

# Si cela retourne du HTML, le problème est dans le routage Traefik
# Si cela retourne du JSON, le backend fonctionne et le problème est ailleurs
```

## 📝 Notes

- Les endpoints d'alertes nécessitent maintenant une authentification (`@PreAuthorize("isAuthenticated()")`)
- L'endpoint `/api/health` est public et peut être utilisé pour diagnostiquer le routage
- Si `/api/health` retourne du JSON mais `/api/alerts/my-alerts/count` retourne du HTML, il y a un problème spécifique avec cet endpoint

## 🔄 Prochaines Étapes

1. Redémarrer le backend
2. Vérifier les logs du backend
3. Tester l'endpoint `/api/health`
4. Tester l'endpoint `/api/alerts/my-alerts/count` avec un token JWT valide
5. Si le problème persiste, vérifier les logs Traefik

---

**Dernière mise à jour** : Après l'ajout des annotations `@PreAuthorize("isAuthenticated()")` sur les endpoints d'alertes

