# 🔧 Fix Erreur 502 - HTML au lieu de JSON

## 🎯 Problème

La requête `/api/recherche/positions6?termeRecherche=figues` retourne du HTML (page Angular) au lieu de JSON.

## ✅ Solution Rapide

### Étape 1 : Vérifier les logs du backend

```bash
docker compose logs backend --tail=100
```

Chercher des erreurs comme :
- `Table "usage_log" does not exist`
- `Application startup failed`
- `Connection refused`

### Étape 2 : Redémarrer le backend

```bash
# Redémarrer le backend
docker compose restart backend

# Attendre quelques secondes que le backend démarre
sleep 10

# Vérifier les logs
docker compose logs backend --tail=50
```

### Étape 3 : Vérifier que la table existe

```bash
# Se connecter à la base de données
docker compose exec app-db psql -U muhend -d app-db

# Vérifier que la table existe
\dt usage_log

# Si la table n'existe pas, elle sera créée au redémarrage avec ddl-auto=update
```

### Étape 4 : Vérifier que `ddl-auto=update` est actif

Vérifier dans `backend/src/main/resources/application.yml` :

**Ligne 19** (configuration par défaut) :
```yaml
ddl-auto: update  # Doit être activé
```

**Ligne 121** (profil PRODUCTION) :
```yaml
ddl-auto: update  # Doit être activé si SPRING_PROFILES_ACTIVE=prod
```

### Étape 5 : Rebuilder et redémarrer

Si les modifications de `application.yml` ne sont pas prises en compte :

```bash
# Rebuilder le backend
docker compose build backend

# Redémarrer
docker compose up -d backend

# Vérifier les logs
docker compose logs -f backend
```

## 🔍 Diagnostic Détaillé

### Vérifier que le backend répond

```bash
# Depuis l'intérieur du conteneur
docker compose exec backend curl http://localhost:8081/actuator/health

# Depuis l'extérieur (si les ports sont exposés)
curl http://localhost:8081/actuator/health
```

### Vérifier les routes Traefik

```bash
# Vérifier que Traefik voit le backend
docker compose exec traefik wget -qO- http://localhost:8080/api/http/routers | grep backend
```

### Vérifier la configuration du service backend

Dans `docker-compose-prod.yml`, vérifier que :
- Le backend est dans le réseau `webproxy` (ligne 227)
- Les labels Traefik sont appliqués (ligne 223)
- Le port est correct (ligne 199)

## ⚠️ Cause Probable

Le backend crash au démarrage à cause de :
1. **Table `usage_log` absente** → Résolu avec `ddl-auto=update`
2. **Erreur de configuration** → Vérifier les logs
3. **Problème de connexion à la base de données** → Vérifier les variables d'environnement

## ✅ Vérification Finale

Une fois le backend redémarré, tester :

```bash
# Tester l'endpoint (nécessite un token JWT valide)
curl -H "Authorization: Bearer <token>" \
  https://www.hscode.enclume-numerique.com/api/recherche/positions6?termeRecherche=figues
```

La réponse doit être du JSON, pas du HTML.

## 🚨 Si le problème persiste

1. **Vérifier les logs complets** :
   ```bash
   docker compose logs backend > backend-logs.txt
   ```

2. **Vérifier la configuration** :
   - Vérifier que `application.yml` a bien `ddl-auto: update`
   - Vérifier que le profil actif est correct
   - Vérifier les variables d'environnement

3. **Créer la table manuellement** :
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
   ```

4. **Redémarrer tous les services** :
   ```bash
   docker compose down
   docker compose up -d
   ```

---

**Note** : Après création de la table, remettre `ddl-auto: validate` dans `application.yml` pour la sécurité en production.

