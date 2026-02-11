# Guide d'utilisation de l'API Batch pour la recherche de codes HS

## 📋 Vue d'ensemble

L'API Message Batches permet de traiter plusieurs recherches de codes HS de manière asynchrone, avec une **réduction de 50% du coût** par rapport à l'API temps réel.

### Cas d'usage recommandés

✅ **Adapté pour :**
- Import de fichiers Excel/CSV/TSV avec plusieurs produits
- Analyse de catalogues entiers (centaines ou milliers de produits)
- Exports de recherches multiples pour analyse
- Traitements nocturnes ou en arrière-plan
- Préparation de données pour des rapports

❌ **Pas adapté pour :**
- Recherche interactive en temps réel (utilisez l'API standard)
- Besoins de réponse immédiate
- Recherche d'un seul produit

## 🚀 Démarrage rapide

### 1. Configuration

Assurez-vous que votre clé API Anthropic est configurée dans `.env` ou les variables d'environnement :

```bash
ANTHROPIC_API_KEY=votre_clé_api_ici
AI_PROVIDER=anthropic
```

### 2. Soumettre un batch

**Endpoint :** `POST /batch-search/submit`

**Exemple de requête :**

```bash
curl -X POST http://localhost:8082/batch-search/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <votre_token_jwt>" \
  -d '{
    "searches": [
      {
        "customId": "product-1",
        "searchTerm": "Pommes fraîches de table",
        "ragContext": "RAG pour la recherche des : POSITIONS6\n\n - Code = 0808 10 -\n\n   _Description : Pommes\n\n"
      },
      {
        "customId": "product-2",
        "searchTerm": "T-shirt en coton 100% pour homme",
        "ragContext": "RAG pour la recherche des : POSITIONS6\n\n - Code = 6109 10 -\n\n   _Description : T-shirts et maillots de corps, de bonneterie, de coton\n\n"
      },
      {
        "customId": "product-3",
        "searchTerm": "Drone quadrirotor avec caméra HD",
        "ragContext": "RAG pour la recherche des : POSITIONS6\n\n - Code = 8806 10 -\n\n   _Description : Drones\n\n"
      }
    ]
  }'
```

**Réponse :**

```json
{
  "batchId": "msgbatch_01ABC123xyz",
  "message": "Batch créé avec succès. Utilisez l'ID pour suivre le statut.",
  "statusCode": 200
}
```

### 3. Vérifier le statut

**Endpoint :** `GET /batch-search/status/{batchId}`

```bash
curl http://localhost:8082/batch-search/status/msgbatch_01ABC123xyz \
  -H "Authorization: Bearer <votre_token_jwt>"
```

**Réponse (en cours) :**

```json
{
  "batchId": "msgbatch_01ABC123xyz",
  "status": "in_progress",
  "requestCounts": {
    "processing": 2,
    "succeeded": 1,
    "errored": 0,
    "canceled": 0,
    "expired": 0
  },
  "createdAt": "2025-02-10T10:30:00Z",
  "endedAt": null,
  "resultsAvailable": false,
  "message": "Batch en cours: 2 en traitement, 1 terminées"
}
```

**Réponse (terminé) :**

```json
{
  "batchId": "msgbatch_01ABC123xyz",
  "status": "ended",
  "requestCounts": {
    "processing": 0,
    "succeeded": 3,
    "errored": 0,
    "canceled": 0,
    "expired": 0
  },
  "createdAt": "2025-02-10T10:30:00Z",
  "endedAt": "2025-02-10T10:45:00Z",
  "resultsAvailable": true,
  "message": "Batch terminé: 3/3 succès, 0 erreurs"
}
```

### 4. Récupérer les résultats

**Endpoint :** `GET /batch-search/results/{batchId}`

```bash
curl http://localhost:8082/batch-search/results/msgbatch_01ABC123xyz \
  -H "Authorization: Bearer <votre_token_jwt>"
```

**Réponse :**

```json
{
  "batchId": "msgbatch_01ABC123xyz",
  "message": "Résultats récupérés avec succès",
  "totalResults": 3,
  "successCount": 3,
  "errorCount": 0,
  "results": [
    {
      "customId": "product-1",
      "resultType": "succeeded",
      "content": "[\n  {\n    \"code\": \"0808 10\",\n    \"justification\": \"Correspond aux pommes fraîches de table\"\n  }\n]",
      "inputTokens": 450,
      "outputTokens": 85,
      "errorType": null,
      "errorMessage": null
    },
    {
      "customId": "product-2",
      "resultType": "succeeded",
      "content": "[\n  {\n    \"code\": \"6109 10\",\n    \"justification\": \"T-shirts en coton pour hommes\"\n  }\n]",
      "inputTokens": 420,
      "outputTokens": 78,
      "errorType": null,
      "errorMessage": null
    },
    {
      "customId": "product-3",
      "resultType": "succeeded",
      "content": "[\n  {\n    \"code\": \"8806 10\",\n    \"justification\": \"Drones civils non militaires\"\n  }\n]",
      "inputTokens": 435,
      "outputTokens": 82,
      "errorType": null,
      "errorMessage": null
    }
  ]
}
```

### 5. Annuler un batch (optionnel)

**Endpoint :** `POST /batch-search/cancel/{batchId}`

```bash
curl -X POST http://localhost:8082/batch-search/cancel/msgbatch_01ABC123xyz \
  -H "Authorization: Bearer <votre_token_jwt>"
```

## 📊 États du batch

| État | Description |
|------|-------------|
| `in_progress` | Le batch est en cours de traitement |
| `ended` | Le batch est terminé, résultats disponibles |
| `canceling` | Annulation en cours |
| `canceled` | Batch annulé |

## ⏱️ Délais de traitement

- **Temps moyen :** 1 à 5 minutes pour 100 requêtes
- **Maximum :** 24 heures
- **Recommandation :** Vérifier le statut toutes les 30 secondes pour de petits batches (< 100 requêtes)

## 💰 Comparaison des coûts

| Modèle | API Standard | API Batch | Économie |
|--------|-------------|-----------|----------|
| Claude Sonnet 4.5 | $3 / MTok entrée<br>$15 / MTok sortie | $1.50 / MTok entrée<br>$7.50 / MTok sortie | **50%** |

**Exemple de calcul :**

Pour 1000 recherches avec une moyenne de 500 tokens entrée et 100 tokens sortie par requête :

- **API Standard :** (1000 × 500 × $3 / 1M) + (1000 × 100 × $15 / 1M) = $1.50 + $1.50 = **$3.00**
- **API Batch :** (1000 × 500 × $1.50 / 1M) + (1000 × 100 × $7.50 / 1M) = $0.75 + $0.75 = **$1.50**
- **Économie :** $1.50 (50%)

## 🔧 Intégration dans l'application

### Exemple avec Spring RestTemplate

```java
@Service
public class BatchSearchIntegrationService {

    @Autowired
    private RestTemplate restTemplate;

    public String submitBatchFromFile(List<String> productDescriptions, String ragContext) {
        List<SearchItem> searches = productDescriptions.stream()
            .map(desc -> {
                SearchItem item = new SearchItem();
                item.setCustomId("product-" + UUID.randomUUID());
                item.setSearchTerm(desc);
                item.setRagContext(ragContext);
                return item;
            })
            .collect(Collectors.toList());

        BatchSearchRequest request = new BatchSearchRequest();
        request.setSearches(searches);

        ResponseEntity<BatchSubmitResponse> response = restTemplate.postForEntity(
            "http://localhost:8082/batch-search/submit",
            request,
            BatchSubmitResponse.class
        );

        return response.getBody().getBatchId();
    }

    public BatchStatusResponse checkStatus(String batchId) {
        return restTemplate.getForObject(
            "http://localhost:8082/batch-search/status/" + batchId,
            BatchStatusResponse.class
        );
    }
}
```

### Exemple avec frontend Angular

```typescript
export class BatchSearchService {
  private apiUrl = '/api/batch-search';

  constructor(private http: HttpClient) {}

  submitBatch(searches: SearchItem[]): Observable<BatchSubmitResponse> {
    return this.http.post<BatchSubmitResponse>(
      `${this.apiUrl}/submit`,
      { searches }
    );
  }

  checkStatus(batchId: string): Observable<BatchStatusResponse> {
    return this.http.get<BatchStatusResponse>(
      `${this.apiUrl}/status/${batchId}`
    );
  }

  getResults(batchId: string): Observable<BatchResultsResponse> {
    return this.http.get<BatchResultsResponse>(
      `${this.apiUrl}/results/${batchId}`
    );
  }

  // Polling automatique du statut
  pollBatchStatus(batchId: string, intervalMs: number = 30000): Observable<BatchStatusResponse> {
    return interval(intervalMs).pipe(
      startWith(0),
      switchMap(() => this.checkStatus(batchId)),
      takeWhile(status => status.status === 'in_progress', true)
    );
  }
}
```

## 📝 Bonnes pratiques

1. **Taille des batches**
   - Optimale : 100-500 requêtes par batch
   - Maximum : 1000 requêtes (limite configurée)
   - Pour de très gros volumes, diviser en plusieurs batches

2. **Polling du statut**
   - Petits batches (< 100) : Vérifier toutes les 30 secondes
   - Batches moyens (100-500) : Vérifier toutes les 1-2 minutes
   - Gros batches (> 500) : Vérifier toutes les 5 minutes

3. **Gestion des erreurs**
   - Toujours vérifier le `resultType` de chaque résultat
   - Logger les requêtes avec `resultType: "errored"`
   - Prévoir un mécanisme de retry pour les erreurs

4. **RAG Context**
   - Fournir un contexte RAG pertinent pour chaque recherche
   - Éviter les contextes trop volumineux (> 50 KB)
   - Réutiliser le même contexte pour des recherches similaires

5. **Formats de fichiers supportés**
   - **TXT** : Un terme de recherche par ligne
   - **CSV** : Première colonne extraite (format: `"terme1","autre_info"`)
   - **TSV** : Première colonne extraite (séparateur: tabulation)
   - **Excel (.xls, .xlsx)** : Première colonne de la première feuille extraite
   - **OpenDocument (.ods)** : Première colonne de la première feuille extraite
   - Maximum 1000 lignes par fichier
   - Encodage recommandé : UTF-8

## 🛠️ Tests et validation

### Test avec curl

Script bash pour tester le workflow complet :

```bash
#!/bin/bash

# 1. Soumettre le batch
BATCH_RESPONSE=$(curl -s -X POST http://localhost:8082/batch-search/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d @batch-request.json)

BATCH_ID=$(echo $BATCH_RESPONSE | jq -r '.batchId')
echo "Batch créé: $BATCH_ID"

# 2. Attendre que le batch soit terminé
while true; do
  STATUS=$(curl -s http://localhost:8082/batch-search/status/$BATCH_ID \
    -H "Authorization: Bearer $JWT_TOKEN" | jq -r '.status')

  echo "Statut: $STATUS"

  if [ "$STATUS" = "ended" ]; then
    break
  fi

  sleep 30
done

# 3. Récupérer les résultats
curl -s http://localhost:8082/batch-search/results/$BATCH_ID \
  -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
```

## Providers Supportés

L'API Batch supporte actuellement deux providers :

### Anthropic (Claude)
- **Modèle** : claude-sonnet-4-5-20250929
- **Endpoint** : `/v1/messages/batches`
- **Réduction de coût** : 50%
- **Configuration** : `AI_PROVIDER=anthropic`

### OpenAI (GPT)
- **Modèle** : gpt-4o-mini (configurable via `OPENAI_MODEL`)
- **Endpoint** : `/v1/batches` (avec upload de fichiers JSONL)
- **Réduction de coût** : 50%
- **Configuration** : `AI_PROVIDER=openai`

### Configuration du provider

Pour choisir le provider, définir la variable d'environnement :

```bash
# Utiliser OpenAI pour batch
export AI_PROVIDER=openai

# Utiliser Anthropic pour batch
export AI_PROVIDER=anthropic
```

**Note** : Le même provider sera utilisé pour les recherches standards et batch.

## 📚 Références

- [Documentation officielle Anthropic Batches API](https://docs.anthropic.com/en/api/batches)
- [Documentation officielle OpenAI Batch API](https://platform.openai.com/docs/guides/batch)
- [Pricing Anthropic](https://www.anthropic.com/pricing)
- [Pricing OpenAI](https://openai.com/pricing)
- Code source :
  - Interface : `search-service/src/main/java/com/tarif/search/service/ai/batch/BatchProvider.java`
  - Orchestrateur : `search-service/src/main/java/com/tarif/search/service/ai/batch/BatchService.java`
  - Provider Anthropic : `search-service/src/main/java/com/tarif/search/service/ai/batch/AnthropicBatchProvider.java`
  - Provider OpenAI : `search-service/src/main/java/com/tarif/search/service/ai/batch/OpenAiBatchProvider.java`
  - Contrôleur : `search-service/src/main/java/com/tarif/search/controller/BatchSearchController.java`

## 🐛 Dépannage

### Erreur : "Clé API non configurée"
- Vérifier que `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY` est définie selon le provider actif
- Redémarrer le service après avoir modifié la configuration

### Erreur : "Le provider actuel ne supporte pas les opérations batch"
- Vérifier que `AI_PROVIDER` est défini à `openai` ou `anthropic`
- Le provider `ollama` ne supporte pas les opérations batch

### Erreur : "Batch introuvable"
- Vérifier que l'ID du batch est correct
- Les batches expirent après 30 jours

### Résultats vides
- Vérifier que le batch est terminé (`status: "ended"`)
- Vérifier que `resultsAvailable: true`
- Consulter les logs du service pour plus de détails

## 💡 Améliorations futures

- [ ] Webhooks pour notification de fin de batch
- [ ] Interface UI pour gérer les batches
- [ ] Export des résultats en CSV/Excel
- [ ] Persistance des batches en base de données
- [ ] Statistiques et analytics des batches
