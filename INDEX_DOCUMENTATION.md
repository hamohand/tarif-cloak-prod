# Index de la Documentation - Système de Facturation

## 📚 Documentation Disponible

### 1. Vue d'Ensemble
- **`README_PHASES.md`** : Vue d'ensemble rapide des phases implémentées
- **`PLAN_MVP_FACTURATION.md`** : Plan initial du MVP avec statut des phases

### 2. Documentation Détaillée
- **`DOCUMENTATION_PHASES.md`** : Documentation complète et détaillée de toutes les phases
  - Phase 1 : Tracking Basique
  - Phase 2 : Association Utilisateur → Entreprise
  - Phase 3 : Visualisation Simple
  - Phase 4 : Quotas Basiques

### 3. Stratégie
- **`STRATEGIE_FACTURATION.md`** : Stratégie complète de facturation (vision long terme)

### 4. Tests
- **`TESTS_QUOTA.md`** : Documentation complète des tests de quota
- **`RESUME_TESTS_QUOTA.md`** : Résumé des tests créés
- **`test-quota.sh`** : Script de test bash (Linux/Mac)
- **`test-quota-windows.ps1`** : Script de test PowerShell (Windows)

## 🗂️ Structure de la Documentation

```
Documentation/
├── INDEX_DOCUMENTATION.md          # Ce fichier (index)
├── README_PHASES.md                # Vue d'ensemble rapide
├── DOCUMENTATION_PHASES.md         # Documentation détaillée complète
├── PLAN_MVP_FACTURATION.md         # Plan initial du MVP
├── STRATEGIE_FACTURATION.md        # Stratégie complète
├── TESTS_QUOTA.md                  # Tests de quota (détaillés)
├── RESUME_TESTS_QUOTA.md           # Résumé des tests
├── test-quota.sh                   # Script de test (bash)
└── test-quota-windows.ps1          # Script de test (PowerShell)
```

## 🎯 Parcours de Lecture Recommandé

### Pour une Vue d'Ensemble Rapide
1. **`README_PHASES.md`** - Vue d'ensemble des phases implémentées
2. **`PLAN_MVP_FACTURATION.md`** - Plan initial avec statut

### Pour Comprendre une Phase Spécifique
1. **`DOCUMENTATION_PHASES.md`** - Section correspondante à la phase
2. Consulter les fichiers de code mentionnés dans la documentation

### Pour Tester
1. **`RESUME_TESTS_QUOTA.md`** - Résumé des tests disponibles
2. **`TESTS_QUOTA.md`** - Documentation détaillée des tests
3. Exécuter les scripts de test (`test-quota.sh` ou `test-quota-windows.ps1`)

### Pour Comprendre la Vision Long Terme
1. **`STRATEGIE_FACTURATION.md`** - Stratégie complète
2. **`DOCUMENTATION_PHASES.md`** - Section "Prochaines Phases"

## 📋 Phases Documentées

### ✅ Phase 1 : Tracking Basique
- **Documentation** : `DOCUMENTATION_PHASES.md` - Phase 1
- **Statut** : Terminée
- **Fichiers principaux** :
  - `UsageLog` (entité)
  - `UsageLogService` (service)
  - `UsageLogRepository` (repository)
- **Endpoints** :
  - `GET /admin/usage-logs`

### ✅ Phase 2 : Association Utilisateur → Entreprise
- **Documentation** : `DOCUMENTATION_PHASES.md` - Phase 2
- **Statut** : Terminée
- **Fichiers principaux** :
  - `Organization` (entité)
  - `OrganizationUser` (entité)
  - `OrganizationService` (service)
  - `OrganizationController` (controller)
- **Endpoints** :
  - `POST /admin/organizations`
  - `GET /admin/organizations`
  - `GET /admin/organizations/{id}`
  - `POST /admin/organizations/{id}/users`
  - `DELETE /admin/organizations/{id}/users/{userId}`
  - `GET /admin/organizations/{id}/users`
  - `GET /admin/organizations/user/{userId}`

### ✅ Phase 3 : Visualisation Simple
- **Documentation** : `DOCUMENTATION_PHASES.md` - Phase 3
- **Statut** : Terminée
- **Fichiers principaux** :
  - `AdminController.getUsageStats()` (endpoint)
  - `StatsComponent` (frontend)
- **Endpoints** :
  - `GET /admin/usage/stats`
- **Frontend** :
  - Page `/admin/stats`

### ✅ Phase 4 : Quotas Basiques
- **Documentation** : `DOCUMENTATION_PHASES.md` - Phase 4
- **Statut** : Terminée
- **Fichiers principaux** :
  - `QuotaExceededException` (exception)
  - `GlobalExceptionHandler` (gestionnaire d'exceptions)
  - `OrganizationService.checkQuota()` (service)
- **Endpoints** :
  - `PUT /admin/organizations/{id}/quota`
- **Tests** :
  - `OrganizationServiceTest` (tests unitaires)
  - `QuotaExceededExceptionTest` (tests unitaires)
  - Scripts de test manuels

## 🔍 Recherche Rapide

### Par Sujet

#### Tracking et Logging
- Phase 1 : Tracking Basique
- `DOCUMENTATION_PHASES.md` - Phase 1
- `UsageLog`, `UsageLogService`, `UsageLogRepository`

#### Organisations
- Phase 2 : Association Utilisateur → Entreprise
- `DOCUMENTATION_PHASES.md` - Phase 2
- `Organization`, `OrganizationUser`, `OrganizationService`

#### Statistiques
- Phase 3 : Visualisation Simple
- `DOCUMENTATION_PHASES.md` - Phase 3
- `AdminController.getUsageStats()`, `StatsComponent`

#### Quotas
- Phase 4 : Quotas Basiques
- `DOCUMENTATION_PHASES.md` - Phase 4
- `TESTS_QUOTA.md`, `RESUME_TESTS_QUOTA.md`
- `OrganizationService.checkQuota()`, `QuotaExceededException`

#### Tests
- `TESTS_QUOTA.md` - Documentation complète
- `RESUME_TESTS_QUOTA.md` - Résumé
- `test-quota.sh` - Script bash
- `test-quota-windows.ps1` - Script PowerShell

## 📝 Notes

- Tous les endpoints d'administration nécessitent le rôle ADMIN
- Les endpoints de recherche nécessitent le rôle USER ou ADMIN
- La documentation est mise à jour au fur et à mesure de l'implémentation
- Pour les phases futures, consulter `DOCUMENTATION_PHASES.md` - Section "Prochaines Phases"

## 🔗 Liens Utiles

- **Swagger UI** : `https://www.hscode.enclume-numerique.com/swagger-ui.html`
- **API Docs** : `https://www.hscode.enclume-numerique.com/v3/api-docs`
- **Backend Tests** : `backend/src/test/java/com/muhend/backend/`
- **Frontend Stats** : `/admin/stats` (accessible aux ADMIN uniquement)

---

*Dernière mise à jour : Phase 4 complétée*

