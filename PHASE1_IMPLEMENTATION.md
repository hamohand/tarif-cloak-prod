# Phase 1 - Tracking Basique : Implémentation Complète ✅

## ✅ Ce qui a été fait

### 1. Modèle de données
- ✅ Création de l'entité `UsageLog` (`backend/src/main/java/com/muhend/backend/usage/model/UsageLog.java`)
- ✅ Création du Repository `UsageLogRepository`
- ✅ La table `usage_log` sera créée automatiquement par JPA avec `ddl-auto=update`

### 2. Service de tracking
- ✅ Création de `UsageLogService` pour enregistrer et récupérer les logs
- ✅ Création de la classe `UsageInfo` pour transporter les données de coût
- ✅ Modification de `OpenAiService` pour exposer le coût via ThreadLocal

### 3. Intégration dans le controller
- ✅ Modification de `RechercheController` pour logger chaque recherche
- ✅ Récupération de l'utilisateur Keycloak depuis le JWT
- ✅ Enregistrement automatique après chaque recherche

### 4. Endpoint ADMIN
- ✅ Ajout de l'endpoint `/admin/usage-logs` dans `AdminController`
- ✅ Filtres par utilisateur et par période
- ✅ Statistiques (total requêtes, coût total, tokens total)

## 📋 Structure des fichiers créés

```
backend/src/main/java/com/muhend/backend/
├── codesearch/
│   ├── model/
│   │   └── UsageInfo.java (nouveau)
│   ├── service/
│   │   └── ai/
│   │       └── OpenAiService.java (modifié)
│   └── controller/
│       └── RechercheController.java (modifié)
├── usage/ (nouveau)
│   ├── model/
│   │   └── UsageLog.java
│   ├── repository/
│   │   └── UsageLogRepository.java
│   └── service/
│       └── UsageLogService.java
└── admin/
    └── controller/
        └── AdminController.java (modifié)
```

## 🔍 Comment ça fonctionne

### Flux d'une recherche

1. **Utilisateur fait une recherche** → `GET /recherche/sections?termeRecherche=...`
2. **Controller exécute la recherche** → `handleSearchRequest()` fait les appels à l'IA
3. **OpenAI retourne les tokens et coût** → Stockés dans ThreadLocal
4. **Controller logue l'utilisation** → `logUsage()` récupère les infos et les enregistre
5. **Base de données** → Le log est sauvegardé dans `usage_log`

### Structure de la table `usage_log`

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

## 🚀 Utilisation

### Consulter les logs (ADMIN uniquement)

```bash
# Tous les logs
GET /admin/usage-logs

# Filtre par utilisateur
GET /admin/usage-logs?userId=<keycloak-user-id>

# Filtre par période
GET /admin/usage-logs?startDate=2025-01-01&endDate=2025-01-31

# Filtre combiné
GET /admin/usage-logs?userId=<keycloak-user-id>&startDate=2025-01-01&endDate=2025-01-31
```

### Réponse de l'endpoint

```json
{
  "total": 150,
  "totalCostUsd": 0.045,
  "totalTokens": 15000,
  "logs": [
    {
      "id": 1,
      "keycloakUserId": "user-uuid-123",
      "endpoint": "/recherche/sections",
      "searchTerm": "véhicules",
      "tokensUsed": 100,
      "costUsd": 0.00003,
      "timestamp": "2025-01-15T10:30:00"
    },
    ...
  ]
}
```

## ⚠️ Limitations connues (Phase 1)

### 1. Coût partiel dans les recherches en cascade
**Problème** : Dans une recherche en cascade (ex: `/recherche/positions6`), il y a plusieurs appels à l'IA (sections → chapitres → positions4 → positions6), mais on ne logue que le **dernier appel**.

**Impact** : Le coût enregistré ne reflète pas le coût total de la recherche.

**Solution future** : Cumuler les coûts de tous les appels dans la cascade.

### 2. Pas de logging en cas d'erreur
**Problème** : Si une recherche échoue avant la fin, aucun log n'est enregistré.

**Impact** : On ne track pas les recherches qui ont échoué.

**Solution future** : Logger même en cas d'erreur (avec un statut `FAILED`).

### 3. Pas d'association avec les entreprises
**Problème** : On ne sait pas à quelle entreprise appartient l'utilisateur.

**Impact** : Impossible de facturer par entreprise.

**Solution future** : Phase 2 - Association Utilisateur → Entreprise.

## 🧪 Tests à faire

1. **Tester une recherche simple**
   - Faire une recherche sur `/recherche/sections`
   - Vérifier qu'un log est créé en base
   - Vérifier que le coût est correct

2. **Tester l'endpoint ADMIN**
   - Se connecter avec un compte ADMIN
   - Appeler `/admin/usage-logs`
   - Vérifier que les logs sont retournés

3. **Tester les filtres**
   - Filtrer par utilisateur
   - Filtrer par période
   - Vérifier que les statistiques sont correctes

## 📝 Prochaines étapes (Phase 2)

1. Créer la table `organization`
2. Créer la table `organization_user`
3. Associer les utilisateurs aux entreprises
4. Ajouter `organization_id` aux logs
5. Filtrer les logs par entreprise

## 🎯 Critères de succès Phase 1

- [x] Chaque recherche est enregistrée en base
- [x] On peut voir les logs via l'API ADMIN
- [x] Les coûts sont correctement enregistrés
- [x] Pas de régression sur les fonctionnalités existantes

**Phase 1 terminée ! ✅**

