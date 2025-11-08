# Guide : Activation Temporaire de `ddl-auto=update`

## ✅ Changements effectués

Le fichier `application.yml` a été modifié pour activer `ddl-auto: update` temporairement dans :
- Configuration par défaut (ligne 19)
- Profil PRODUCTION (ligne 121)

## 🎯 Objectif

Créer automatiquement la table `usage_log` lors du prochain démarrage de l'application.

## 📋 Étapes

### 1. Redémarrer l'application

Lors du prochain démarrage, Hibernate créera automatiquement la table `usage_log` avec la structure suivante :

```sql
CREATE TABLE usage_log (
    id BIGSERIAL PRIMARY KEY,
    keycloak_user_id VARCHAR(255) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    search_term VARCHAR(500),
    tokens_used INTEGER,
    cost_usd DECIMAL(10, 6),
    timestamp TIMESTAMP NOT NULL
);
```

### 2. Vérifier la création de la table

Une fois l'application redémarrée, vérifier que la table a été créée :

```sql
-- Se connecter à la base de données PostgreSQL
psql -h localhost -U muhend -d app-db

-- Vérifier que la table existe
\dt usage_log

-- Voir la structure de la table
\d usage_log
```

### 3. Revenir à `ddl-auto=validate` (IMPORTANT)

⚠️ **Après la création de la table, il est crucial de revenir à `ddl-auto: validate` pour la production.**

#### Modifications à faire dans `application.yml` :

**Ligne 19** (configuration par défaut) :
```yaml
  jpa:
    hibernate:
#      ddl-auto: update  # Temporairement activé pour créer la table usage_log. Revenir à 'validate' après la création.
      ddl-auto: validate  #En production (?), utilisez 'validate' ou Flyway/Liquibase
```

**Ligne 121** (profil PRODUCTION) :
```yaml
  jpa:
    hibernate:
#      ddl-auto: update  # Temporairement activé pour créer la table usage_log. Revenir à 'validate' après la création.
      ddl-auto: validate  # Ne pas modifier le schéma automatiquement
```

### 4. Redémarrer l'application

Redémarrer l'application après avoir remis `ddl-auto: validate`.

## ⚠️ Pourquoi revenir à `validate` ?

- **Sécurité** : `update` peut modifier ou supprimer des données de manière inattendue
- **Contrôle** : En production, on veut contrôler exactement les modifications du schéma
- **Historique** : Les migrations doivent être versionnées (Flyway/Liquibase)

## 🔄 Alternative : Migration SQL

Si vous préférez créer la table manuellement sans utiliser `ddl-auto=update`, vous pouvez exécuter ce script SQL :

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

Puis garder `ddl-auto: validate` directement.

## ✅ Checklist

- [ ] Redémarrer l'application avec `ddl-auto: update`
- [ ] Vérifier que la table `usage_log` a été créée
- [ ] Remettre `ddl-auto: validate` dans `application.yml`
- [ ] Redémarrer l'application
- [ ] Vérifier que tout fonctionne correctement

---

**Note** : Cette configuration est temporaire. Une fois la table créée, revenir immédiatement à `validate` pour la sécurité en production.

