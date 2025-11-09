# Tests pour la Phase 4 : Quotas Basiques

Ce document décrit les tests à effectuer pour vérifier le fonctionnement du système de quotas.

## Prérequis

1. Backend démarré et accessible
2. Base de données PostgreSQL opérationnelle
3. Utilisateur ADMIN authentifié dans Keycloak
4. Token d'accès valide pour les requêtes API

## Tests Unitaires

Les tests unitaires peuvent être exécutés avec :

```bash
cd backend
./mvnw test
```

### Tests créés

1. **OrganizationServiceTest** : Tests pour `checkQuota()` et `updateMonthlyQuota()`
2. **QuotaExceededExceptionTest** : Tests pour l'exception de quota dépassé

## Tests d'Intégration (Manuels)

### Test 1 : Créer une organisation avec quota

```bash
# Créer une organisation
curl -X POST https://www.hscode.enclume-numerique.com/api/admin/organizations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "name": "Entreprise Test Quota"
  }'

# Réponse attendue : Organisation créée avec ID
# Notez l'ID de l'organisation (par exemple: 1)
```

### Test 2 : Définir un quota pour l'organisation

```bash
# Définir un quota de 10 requêtes par mois
curl -X PUT https://www.hscode.enclume-numerique.com/api/admin/organizations/1/quota \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "monthlyQuota": 10
  }'

# Réponse attendue : Organisation mise à jour avec monthlyQuota: 10
```

### Test 3 : Vérifier que le quota est enregistré

```bash
# Récupérer l'organisation
curl -X GET https://www.hscode.enclume-numerique.com/api/admin/organizations/1 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Réponse attendue : Organisation avec monthlyQuota: 10
```

### Test 4 : Associer un utilisateur à l'organisation

```bash
# Ajouter un utilisateur à l'organisation
curl -X POST https://www.hscode.enclume-numerique.com/api/admin/organizations/1/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "keycloakUserId": "USER_KEYCLOAK_ID"
  }'

# Réponse attendue : Utilisateur ajouté avec succès
```

### Test 5 : Effectuer des recherches jusqu'à atteindre le quota

```bash
# Effectuer 10 recherches (jusqu'à atteindre le quota)
for i in {1..10}; do
  echo "Recherche $i/10"
  curl -X GET "https://www.hscode.enclume-numerique.com/api/recherche/positions6?termeRecherche=test$i" \
    -H "Authorization: Bearer USER_TOKEN"
  echo ""
  sleep 1
done

# Réponses attendues : 10 recherches réussies avec résultats
```

### Test 6 : Vérifier que le quota est atteint (11ème recherche)

```bash
# Tentative de 11ème recherche (quota dépassé)
curl -X GET "https://www.hscode.enclume-numerique.com/api/recherche/positions6?termeRecherche=test11" \
  -H "Authorization: Bearer USER_TOKEN"

# Réponse attendue : HTTP 429 (Too Many Requests)
# Body: {
#   "error": "QUOTA_EXCEEDED",
#   "message": "Quota mensuel dépassé pour l'organisation 'Entreprise Test Quota' (ID: 1). Utilisation: 10/10 requêtes",
#   "status": 429
# }
```

### Test 7 : Vérifier les statistiques d'utilisation

```bash
# Récupérer les statistiques pour l'organisation
curl -X GET "https://www.hscode.enclume-numerique.com/api/admin/usage/stats?organizationId=1" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Réponse attendue : Statistiques avec 10 requêtes pour l'organisation
```

### Test 8 : Mettre le quota à null (quota illimité)

```bash
# Mettre le quota à null pour quota illimité
curl -X PUT https://www.hscode.enclume-numerique.com/api/admin/organizations/1/quota \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "monthlyQuota": null
  }'

# Réponse attendue : Organisation avec monthlyQuota: null
```

### Test 9 : Vérifier que les recherches fonctionnent avec quota illimité

```bash
# Effectuer une recherche après avoir mis le quota à null
curl -X GET "https://www.hscode.enclume-numerique.com/api/recherche/positions6?termeRecherche=test_unlimited" \
  -H "Authorization: Bearer USER_TOKEN"

# Réponse attendue : Recherche réussie (quota illimité)
```

### Test 10 : Vérifier qu'un utilisateur sans organisation peut effectuer des recherches

```bash
# Utiliser un utilisateur qui n'est dans aucune organisation
curl -X GET "https://www.hscode.enclume-numerique.com/api/recherche/positions6?termeRecherche=test_no_org" \
  -H "Authorization: Bearer USER_WITHOUT_ORG_TOKEN"

# Réponse attendue : Recherche réussie (utilisateur sans organisation autorisé)
```

## Tests de Validation

### Vérifications à effectuer

1. ✅ Le quota est correctement enregistré dans la base de données
2. ✅ Les recherches sont comptabilisées dans le mois en cours
3. ✅ Le quota est vérifié avant chaque recherche
4. ✅ L'exception QuotaExceededException est levée quand le quota est dépassé
5. ✅ Le code HTTP 429 est retourné quand le quota est dépassé
6. ✅ Les recherches ne sont pas loggées si le quota est dépassé
7. ✅ Le quota illimité (null) fonctionne correctement
8. ✅ Les utilisateurs sans organisation peuvent effectuer des recherches

## Tests de Performance

### Vérifier que la vérification du quota n'impacte pas les performances

```bash
# Mesurer le temps de réponse avec quota
time curl -X GET "https://www.hscode.enclume-numerique.com/api/recherche/positions6?termeRecherche=test" \
  -H "Authorization: Bearer USER_TOKEN"

# Comparer avec le temps sans vérification de quota (utilisateur sans organisation)
```

## Notes

- Les quotas sont réinitialisés au début de chaque mois
- Le comptage se fait sur le mois en cours (du 1er au dernier jour du mois)
- Si une organisation n'a pas de quota défini (null), elle a un quota illimité
- Les utilisateurs sans organisation peuvent effectuer des recherches sans limite

## Dépannage

### Le quota n'est pas vérifié

- Vérifier que l'utilisateur est bien associé à une organisation
- Vérifier que l'organisation a un quota défini (non null)
- Vérifier les logs du backend pour voir si la vérification est effectuée

### L'exception n'est pas levée

- Vérifier que le quota est bien atteint (compter les requêtes du mois)
- Vérifier que la date est correcte (le comptage se fait sur le mois en cours)
- Vérifier les logs du backend pour voir les erreurs éventuelles

### Le code HTTP n'est pas 429

- Vérifier que le gestionnaire d'exceptions global est bien configuré
- Vérifier que l'exception QuotaExceededException est bien propagée
- Vérifier les logs du backend pour voir les erreurs éventuelles

