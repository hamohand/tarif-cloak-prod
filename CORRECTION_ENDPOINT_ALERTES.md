# 🔧 Correction - Endpoint `/api/alerts/my-alerts/count`

## ❌ Problème Identifié

L'endpoint `/api/alerts/my-alerts/count` retourne du HTML (page Angular) au lieu de JSON, ce qui indique que la requête n'atteint pas le backend et est routée vers le frontend.

## ✅ Corrections Appliquées

### 1. Ajout des annotations `@PreAuthorize("isAuthenticated()")`

J'ai ajouté les annotations `@PreAuthorize("isAuthenticated()")` sur tous les endpoints d'alertes dans `AlertController.java` :

- ✅ `GET /alerts/my-alerts` 
- ✅ `GET /alerts/my-alerts/count`
- ✅ `PUT /alerts/{alertId}/read`
- ✅ `PUT /alerts/my-alerts/read-all`

Ces annotations garantissent que les endpoints nécessitent une authentification et sont correctement protégés par Spring Security.

## 🚨 Action Requise : REDÉMARRER LE BACKEND

**IMPORTANT** : Le backend doit être redémarré pour que les modifications prennent effet.

### Option 1 : Redémarrage simple

```bash
docker-compose -f docker-compose-prod.yml restart backend
```

### Option 2 : Reconstruction et redémarrage (recommandé)

```bash
docker-compose -f docker-compose-prod.yml up -d --build backend
```

### Option 3 : Redémarrage complet de la stack

```bash
docker-compose -f docker-compose-prod.yml down
docker-compose -f docker-compose-prod.yml up -d
```

## 🔍 Vérification

### 1. Vérifier que le backend démarre correctement

```bash
# Suivre les logs du backend
docker logs -f <container-backend>

# Vérifier qu'il n'y a pas d'erreurs
docker logs <container-backend> 2>&1 | grep -i error
```

### 2. Tester l'endpoint de santé (public)

```bash
curl -k https://www.hscode.enclume-numerique.com/api/health
```

**Résultat attendu** : `{"status":"UP","service":"backend","message":"Backend is running"}`

### 3. Tester l'endpoint d'alertes (authentifié)

```bash
# Remplacer <token> par un token JWT valide
curl -X GET \
  https://www.hscode.enclume-numerique.com/api/alerts/my-alerts/count \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**Résultat attendu** : `{"count": 0}` ou `{"count": <nombre>}`

## 🐛 Diagnostic

Si après le redémarrage le problème persiste :

### 1. Vérifier le routage Traefik

Le fichier `docker-compose-prod.yml` devrait avoir :
- Priorité du backend : `priority: 10` (plus élevée que le frontend)
- Route backend : `PathPrefix(/api)`
- Middleware : `hscode-api-stripprefix` qui enlève le préfixe `/api`

### 2. Vérifier les logs Traefik

```bash
# Vérifier les logs Traefik
docker logs <container-traefik> --tail 100 | grep "backend\|alerts\|/api"
```

### 3. Vérifier que la table existe

```bash
# Se connecter à la base de données
docker exec -it <container-postgres> psql -U <user> -d <database>

# Vérifier que la table existe
\dt quota_alert

# Si la table n'existe pas, elle sera créée automatiquement au démarrage
# (si ddl-auto=update est activé dans application.yml)
```

## 📝 Notes

- Les endpoints d'alertes nécessitent maintenant une authentification explicite
- L'endpoint `/api/health` est public et peut être utilisé pour diagnostiquer le routage
- Si `/api/health` retourne du JSON mais `/api/alerts/my-alerts/count` retourne du HTML, il y a un problème spécifique avec cet endpoint
- Le frontend gère déjà les erreurs en affichant `alertCount = 0` en cas d'erreur

## 🔄 Prochaines Étapes

1. ✅ **Redémarrer le backend** (ACTION REQUISE)
2. ✅ Vérifier les logs du backend
3. ✅ Tester l'endpoint `/api/health`
4. ✅ Tester l'endpoint `/api/alerts/my-alerts/count` avec un token JWT
5. ✅ Si le problème persiste, vérifier les logs Traefik

---

**Fichiers modifiés** :
- `backend/src/main/java/com/muhend/backend/alert/controller/AlertController.java`

**Fichiers créés** :
- `DIAGNOSTIC_ALERTES_ENDPOINT.md` : Guide de diagnostic détaillé
- `diagnostic-alerts.sh` : Script de diagnostic automatique

