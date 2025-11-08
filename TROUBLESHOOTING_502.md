# Troubleshooting : Erreur 502 - HTML au lieu de JSON

## 🔍 Symptôme

La requête `/api/recherche/positions6?termeRecherche=figues` retourne du HTML (page Angular) au lieu de JSON.

## 🎯 Cause probable

Traefik ne peut pas router vers le backend (backend non démarré, crash, ou erreur) et fait un fallback vers le frontend.

## 📋 Étapes de diagnostic

### 1. Vérifier que le backend est démarré

```bash
# Vérifier les conteneurs Docker
docker compose ps

# Vérifier les logs du backend
docker compose logs backend

# Vérifier les logs en temps réel
docker compose logs -f backend
```

### 2. Vérifier que le backend écoute sur le bon port

```bash
# Vérifier que le backend répond
docker compose exec backend curl http://localhost:8081/actuator/health

# Ou depuis l'extérieur (si les ports sont exposés)
curl http://localhost:8081/actuator/health
```

### 3. Vérifier la configuration Traefik

```bash
# Vérifier les routes Traefik
docker compose exec traefik wget -qO- http://localhost:8080/api/http/routers | jq

# Vérifier les services Traefik
docker compose exec traefik wget -qO- http://localhost:8080/api/http/services | jq
```

### 4. Vérifier que la table `usage_log` existe

```bash
# Se connecter à la base de données
docker compose exec app-db psql -U muhend -d app-db

# Vérifier que la table existe
\dt usage_log

# Si la table n'existe pas, elle sera créée au prochain démarrage avec ddl-auto=update
```

### 5. Vérifier les erreurs dans les logs du backend

Chercher dans les logs :
- `Table "usage_log" does not exist` → La table n'existe pas
- `Connection refused` → Problème de connexion à la base de données
- `Port 8081 already in use` → Le port est déjà utilisé
- `Application startup failed` → Erreur au démarrage

## 🔧 Solutions

### Solution 1 : Redémarrer le backend

```bash
# Redémarrer le backend
docker compose restart backend

# Vérifier les logs
docker compose logs -f backend
```

### Solution 2 : Vérifier que `ddl-auto=update` est actif

Vérifier dans `application.yml` que `ddl-auto: update` est activé (ligne 19 et 121).

Si le profil `prod` est activé, vérifier que la ligne 121 a bien `ddl-auto: update`.

### Solution 3 : Créer la table manuellement

Si `ddl-auto=update` ne fonctionne pas, créer la table manuellement :

```sql
CREATE TABLE IF NOT EXISTS usage_log (
    id BIGSERIAL PRIMARY KEY,
    keycloak_user_id VARCHAR(255) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    search_term VARCHAR(500),
    tokens_used INTEGER,
    cost_usd DECIMAL(10, 6),
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_log_user_id ON usage_log(keycloak_user_id);
CREATE INDEX IF NOT EXISTS idx_usage_log_timestamp ON usage_log(timestamp);
```

### Solution 4 : Vérifier la configuration Traefik

Vérifier dans `docker-compose-prod.yml` que :
- Le backend a bien les labels Traefik (lignes 30-47)
- Le service backend est bien dans le réseau `webproxy`
- Le port du backend est correct (`BACKEND_INTERNAL_PORT:-8081`)

### Solution 5 : Vérifier les healthchecks

Vérifier que le backend répond aux healthchecks :

```bash
# Vérifier la santé du backend
docker compose exec backend curl http://localhost:8081/actuator/health
```

## 🚀 Actions immédiates

1. **Vérifier les logs du backend** :
   ```bash
   docker compose logs backend --tail=100
   ```

2. **Redémarrer le backend** :
   ```bash
   docker compose restart backend
   ```

3. **Vérifier que la table existe** :
   ```bash
   docker compose exec app-db psql -U muhend -d app-db -c "\dt usage_log"
   ```

4. **Si la table n'existe pas, redémarrer avec ddl-auto=update** :
   - Vérifier que `application.yml` a bien `ddl-auto: update`
   - Redémarrer le backend
   - La table sera créée automatiquement

## 📝 Notes

- Avec `ddl-auto=update`, Hibernate crée automatiquement la table au démarrage
- Si le backend crash avant la création de la table, Traefik ne peut pas router et fait un fallback
- Après création de la table, remettre `ddl-auto: validate` pour la sécurité

## ✅ Vérification finale

Une fois le backend redémarré, tester :

```bash
# Tester l'endpoint directement (si accessible)
curl -H "Authorization: Bearer <token>" \
  https://www.hscode.enclume-numerique.com/api/recherche/positions6?termeRecherche=figues

# Vérifier que la réponse est du JSON, pas du HTML
```

