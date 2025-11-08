# 🔧 Résolution de l'Erreur 502 - HTML au lieu de JSON

## 🎯 Problèmes Identifiés et Résolus

### 1. ✅ Erreur BigDecimal (RÉSOLU)
**Erreur** : `java.lang.IllegalArgumentException: scale has no meaning for SQL floating point types`

**Cause** : Utilisation de `Double` avec `precision` et `scale` dans JPA, ce qui n'est pas compatible avec PostgreSQL.

**Solution** : Changement de `Double` vers `BigDecimal` dans l'entité `UsageLog`.

### 2. ✅ Priorités Traefik (CORRIGÉ)
**Problème** : Traefik route vers le frontend au lieu du backend pour `/api/**`.

**Solution** : Ajout de priorités explicites :
- Backend : `priority: 10` (priorité élevée)
- Frontend : `priority: 1` (priorité basse)

### 3. ✅ Endpoint de Santé (AJOUTÉ)
**Solution** : Ajout d'un endpoint `/health` pour diagnostiquer si le backend répond.

## 📋 Actions à Effectuer

### Étape 1 : Rebuilder le Backend

```bash
# Rebuilder pour prendre en compte les corrections BigDecimal
docker compose build backend
```

### Étape 2 : Redémarrer les Services

```bash
# Redémarrer le backend
docker compose restart backend

# Redémarrer Traefik pour prendre en compte les nouvelles priorités
docker compose restart traefik

# Ou redémarrer tous les services
docker compose restart
```

### Étape 3 : Vérifier les Logs

```bash
# Vérifier que le backend démarre correctement
docker compose logs backend --tail=100

# Chercher :
# - "Backend Application Started -port:8081-"
# - Pas d'erreur "scale has no meaning"
# - Pas d'erreur "Table usage_log does not exist"
```

### Étape 4 : Tester l'Endpoint de Santé

```bash
# Test depuis le conteneur
docker compose exec backend curl http://localhost:8081/health

# Test via Traefik (depuis le serveur ou via tunnel)
curl https://www.hscode.enclume-numerique.com/api/health

# Réponse attendue :
# {"status":"UP","service":"backend","message":"Backend is running"}
```

### Étape 5 : Tester l'Endpoint de Recherche

```bash
# Test avec un token JWT valide
curl -H "Authorization: Bearer <token>" \
  "https://www.hscode.enclume-numerique.com/api/recherche/positions6?termeRecherche=figues"

# Réponse attendue : JSON, pas HTML
```

## 🔍 Diagnostic si le Problème Persiste

### Si `/health` ne répond pas depuis le conteneur

**Le backend ne démarre pas** :
1. Vérifier les logs : `docker compose logs backend`
2. Vérifier les erreurs de démarrage
3. Vérifier que la table `usage_log` est créée

### Si `/health` répond depuis le conteneur mais pas via Traefik

**Problème de routage Traefik** :
1. Vérifier que le backend est dans le réseau `webproxy`
2. Vérifier les labels Traefik
3. Redémarrer Traefik

### Si `/health` répond mais `/api/recherche/positions6` retourne du HTML

**Problème de priorité des routes** :
1. Vérifier que les priorités sont correctes dans `docker-compose-prod.yml`
2. Vérifier que Traefik a bien rechargé la configuration
3. Redémarrer Traefik

## ✅ Checklist de Vérification

- [ ] Backend rebuildé avec les corrections BigDecimal
- [ ] Backend redémarré et démarre sans erreur
- [ ] Table `usage_log` créée (ou `ddl-auto=update` actif)
- [ ] Endpoint `/health` répond depuis le conteneur
- [ ] Endpoint `/health` répond via Traefik
- [ ] Priorités Traefik correctes (backend=10, frontend=1)
- [ ] Traefik redémarré pour prendre en compte les priorités
- [ ] Endpoint de recherche retourne du JSON, pas du HTML

## 🚀 Commandes Rapides

```bash
# 1. Rebuilder et redémarrer
docker compose build backend
docker compose restart backend traefik

# 2. Vérifier les logs
docker compose logs -f backend

# 3. Tester la santé
docker compose exec backend curl http://localhost:8081/health

# 4. Tester via Traefik
curl https://www.hscode.enclume-numerique.com/api/health
```

---

**Important** : Après avoir appliqué toutes les corrections, redémarrer Traefik est essentiel pour que les nouvelles priorités prennent effet.

