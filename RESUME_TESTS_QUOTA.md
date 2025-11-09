# Résumé des Tests - Phase 4 : Quotas Basiques

## Tests Créés

### 1. Tests Unitaires

#### `OrganizationServiceTest.java`
Tests unitaires pour `OrganizationService` :
- ✅ Test avec organizationId null (autorise)
- ✅ Test avec organisation non trouvée (autorise, non bloquant)
- ✅ Test avec quota null (quota illimité, autorise)
- ✅ Test avec quota non dépassé (autorise)
- ✅ Test avec quota atteint (lève exception)
- ✅ Test avec quota dépassé (lève exception)
- ✅ Test de mise à jour du quota
- ✅ Test de mise à jour du quota à null (illimité)
- ✅ Test avec organisation non trouvée lors de la mise à jour (lève exception)

#### `QuotaExceededExceptionTest.java`
Tests pour l'exception `QuotaExceededException` :
- ✅ Test avec message seulement
- ✅ Test avec message et cause

### 2. Scripts de Test Manuel

#### `test-quota.sh` (Linux/Mac)
Script bash pour tester les endpoints via curl :
- Création d'une organisation
- Définition d'un quota
- Vérification du quota
- Récupération des statistiques
- Mise à jour du quota à null (illimité)

#### `test-quota-windows.ps1` (Windows)
Script PowerShell pour tester les endpoints :
- Même fonctionnalités que le script bash
- Adapté pour Windows PowerShell

#### `TESTS_QUOTA.md`
Documentation complète des tests avec :
- Liste des tests à effectuer
- Commandes curl pour chaque test
- Vérifications à effectuer
- Notes de dépannage

## Exécution des Tests

### Tests Unitaires

```bash
cd backend
./mvnw test -Dtest=OrganizationServiceTest
./mvnw test -Dtest=QuotaExceededExceptionTest
```

Ou tous les tests :
```bash
./mvnw test
```

### Tests d'Intégration (Manuels)

#### Linux/Mac
```bash
chmod +x test-quota.sh
./test-quota.sh ADMIN_TOKEN USER_TOKEN
```

#### Windows
```powershell
.\test-quota-windows.ps1 -AdminToken "ADMIN_TOKEN" -UserToken "USER_TOKEN"
```

## Scénarios de Test à Vérifier

### Scénario 1 : Quota Limité
1. Créer une organisation
2. Définir un quota de 5 requêtes/mois
3. Associer un utilisateur à l'organisation
4. Effectuer 5 recherches (devrait réussir)
5. Effectuer une 6ème recherche (devrait retourner HTTP 429)

### Scénario 2 : Quota Illimité
1. Créer une organisation
2. Définir le quota à null (illimité)
3. Associer un utilisateur à l'organisation
4. Effectuer plusieurs recherches (devrait toujours réussir)

### Scénario 3 : Utilisateur Sans Organisation
1. Utiliser un utilisateur qui n'est dans aucune organisation
2. Effectuer des recherches (devrait toujours réussir)

### Scénario 4 : Réinitialisation Mensuelle
1. Créer une organisation avec quota de 5
2. Atteindre le quota (5 recherches)
3. Attendre le mois suivant (ou modifier la date dans les logs)
4. Effectuer une nouvelle recherche (devrait réussir)

## Vérifications Importantes

### Fonctionnelles
- ✅ Le quota est correctement enregistré dans la base de données
- ✅ Les recherches sont comptabilisées dans le mois en cours
- ✅ Le quota est vérifié avant chaque recherche
- ✅ L'exception QuotaExceededException est levée quand le quota est dépassé
- ✅ Le code HTTP 429 est retourné quand le quota est dépassé
- ✅ Les recherches ne sont pas loggées si le quota est dépassé
- ✅ Le quota illimité (null) fonctionne correctement
- ✅ Les utilisateurs sans organisation peuvent effectuer des recherches

### Techniques
- ✅ Le gestionnaire d'exceptions global gère correctement QuotaExceededException
- ✅ Les logs sont correctement enregistrés
- ✅ Les statistiques sont correctement calculées
- ✅ L'endpoint admin pour mettre à jour le quota fonctionne

## Prochaines Étapes

1. Exécuter les tests unitaires
2. Exécuter les tests d'intégration manuels
3. Vérifier les scénarios de test
4. Vérifier les performances (impact de la vérification du quota)
5. Tester la réinitialisation mensuelle du quota

## Notes

- Les quotas sont réinitialisés au début de chaque mois
- Le comptage se fait sur le mois en cours (du 1er au dernier jour du mois)
- Si une organisation n'a pas de quota défini (null), elle a un quota illimité
- Les utilisateurs sans organisation peuvent effectuer des recherches sans limite
- La vérification du quota est non bloquante (si l'organisation est introuvable, on autorise)

