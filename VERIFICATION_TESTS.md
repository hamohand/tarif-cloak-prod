# Vérification des Tests - Tarif de Base

## Tests créés

### Fichier de test
`backend/src/test/java/com/muhend/backend/codesearch/service/ai/OpenAiServiceCostCalculationTest.java`

### Tests inclus

1. **testBaseRequestPriceIsSet()**
   - Vérifie que le tarif de base est bien injecté dans le service
   - Vérifie que la valeur par défaut est 0.01 USD

2. **testCostCalculationLogic()**
   - Vérifie que le calcul du coût est correct : `coût total = tarif de base + coût des tokens`
   - Vérifie que le coût total est supérieur au tarif de base
   - Vérifie que le tarif de base est bien inclus dans le calcul

3. **testCostWithZeroTokens()**
   - Vérifie que même avec 0 tokens, le tarif de base est appliqué
   - Vérifie que le coût total = tarif de base quand tokens = 0

4. **testCostWithManyTokens()**
   - Vérifie que avec beaucoup de tokens (100k), le coût total est bien supérieur au tarif de base
   - Vérifie que le tarif de base est toujours inclus, même avec beaucoup de tokens

## Comment exécuter les tests

### Option 1 : Via Maven (recommandé)
```bash
cd backend
mvn test -Dtest=OpenAiServiceCostCalculationTest
```

### Option 2 : Via Docker (si le conteneur est en cours d'exécution)
```bash
# Attendre que le conteneur soit prêt
docker ps --filter "name=backend"

# Exécuter les tests dans le conteneur
docker exec hscode-backend mvn test -Dtest=OpenAiServiceCostCalculationTest
```

### Option 3 : Tous les tests
```bash
cd backend
mvn test
```

## Vérification manuelle de la logique

### Calcul attendu
```
Coût total = Tarif de base + Coût des tokens
```

### Exemples de calcul

| Tokens | Tarif de base | Coût tokens | Coût total |
|--------|---------------|-------------|------------|
| 0      | 0.01 USD      | 0.000000 USD| 0.010000 USD|
| 100    | 0.01 USD      | 0.000075 USD| 0.010075 USD|
| 1000   | 0.01 USD      | 0.000750 USD| 0.010750 USD|
| 10000  | 0.01 USD      | 0.007500 USD| 0.017500 USD|
| 100000 | 0.01 USD      | 0.075000 USD| 0.085000 USD|

### Formule de calcul
```
PRICE_INPUT = 0.15 / 1_000_000 = 0.00000015 USD par token input
PRICE_OUTPUT = 0.60 / 1_000_000 = 0.00000060 USD par token output
PRICE_TOTAL = PRICE_INPUT + PRICE_OUTPUT = 0.00000075 USD par token

Coût tokens = totalTokens × PRICE_TOTAL
Coût total = BASE_REQUEST_PRICE_USD + Coût tokens
```

## Vérification dans les logs

Après une requête, vous devriez voir dans les logs :
```
Niveau [niveau] -Total Tokens = [X] tokens
   -Tarif de base = $0.010000
   -Coût tokens = $0.000075
   -Total Prix = $0.010075
```

## Vérification dans la base de données

Les `UsageLog` doivent avoir un `cost_usd` qui inclut le tarif de base :
```sql
SELECT 
    tokens,
    cost_usd,
    CASE 
        WHEN tokens = 0 THEN cost_usd = 0.01
        ELSE cost_usd > 0.01
    END as verification
FROM usage_log
ORDER BY created_at DESC
LIMIT 10;
```

## Points à vérifier

✅ Le tarif de base est configuré (variable `BASE_REQUEST_PRICE_USD`)  
✅ Le calcul inclut le tarif de base  
✅ Les logs affichent le détail du calcul  
✅ Les `UsageLog` incluent le tarif de base dans `cost_usd`  
✅ Les factures reflètent le coût total incluant le tarif de base  

## Prochaines étapes

1. Exécuter les tests unitaires pour vérifier la logique
2. Vérifier les logs après une requête réelle
3. Vérifier les `UsageLog` dans la base de données
4. Vérifier que les factures incluent le tarif de base

