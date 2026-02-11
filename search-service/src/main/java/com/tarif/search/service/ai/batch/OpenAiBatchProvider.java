package com.tarif.search.service.ai.batch;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tarif.search.service.ai.AiPrompts;
import com.tarif.search.service.ai.batch.models.BatchResult;
import com.tarif.search.service.ai.batch.models.BatchStatus;
import com.tarif.search.service.ai.batch.models.SearchRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Implémentation du provider de batch pour OpenAI.
 * Utilise l'API Batch officielle (/v1/batches) avec upload de fichiers JSONL.
 * Offre une réduction de 50% du coût par rapport aux requêtes individuelles.
 *
 * Workflow :
 * 1. Convertir les requêtes en format JSONL
 * 2. Upload du fichier JSONL vers /v1/files
 * 3. Créer le batch via /v1/batches
 * 4. Poller le statut via GET /v1/batches/{id}
 * 5. Télécharger les résultats via /v1/files/{output_file_id}/content
 */
@Service
@Slf4j
public class OpenAiBatchProvider implements BatchProvider {

    private final String apiKey;
    private final String model;
    private final String baseUrl;
    private final ObjectMapper objectMapper;
    private final int maxTokens = 4096;
    private final float temperature = 0.0F;

    public OpenAiBatchProvider(
            @Value("${ai.openai.api-key:}") String apiKey,
            @Value("${ai.openai.model:gpt-4o-mini}") String model,
            @Value("${ai.openai.base-url:https://api.openai.com/v1}") String baseUrl) {
        this.apiKey = apiKey;
        this.model = model;
        this.baseUrl = baseUrl;
        this.objectMapper = new ObjectMapper();
        log.info("OpenAiBatchProvider initialisé avec le modèle: {}", model);
    }

    /**
     * Crée un batch de requêtes pour rechercher plusieurs codes HS.
     * Workflow : Conversion JSONL → Upload fichier → Création batch
     *
     * @param searchRequests Liste des requêtes de recherche
     * @return L'ID du batch créé ou null en cas d'erreur
     */
    @Override
    public String createBatch(List<SearchRequest> searchRequests) {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("Clé API OpenAI non configurée");
            return null;
        }

        if (searchRequests == null || searchRequests.isEmpty()) {
            log.error("Liste de requêtes vide");
            return null;
        }

        try {
            // 1. Convertir en JSONL
            String jsonl = convertToJsonl(searchRequests);
            log.debug("JSONL généré ({} lignes)", searchRequests.size());

            // 2. Upload du fichier JSONL
            String fileId = uploadFile(jsonl);
            if (fileId == null) {
                log.error("Échec de l'upload du fichier JSONL");
                return null;
            }
            log.info("Fichier JSONL uploadé avec succès: {}", fileId);

            // 3. Créer le batch
            String batchId = createBatchFromFile(fileId);
            if (batchId != null) {
                log.info("Batch OpenAI créé avec succès: {} ({} requêtes)", batchId, searchRequests.size());
            }
            return batchId;

        } catch (Exception e) {
            log.error("Erreur lors de la création du batch OpenAI: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * Récupère le statut d'un batch OpenAI.
     *
     * @param batchId L'ID du batch
     * @return Le statut du batch ou null en cas d'erreur
     */
    @Override
    public BatchStatus getBatchStatus(String batchId) {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("Clé API OpenAI non configurée");
            return null;
        }

        try {
            String url = baseUrl + "/batches/" + batchId;

            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(apiKey);

            HttpEntity<Void> entity = new HttpEntity<>(headers);
            RestTemplate restTemplate = new RestTemplate();

            ResponseEntity<String> response = restTemplate.exchange(
                url, HttpMethod.GET, entity, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                JsonNode root = objectMapper.readTree(response.getBody());

                // Mapper le statut OpenAI vers notre modèle commun
                String openAiStatus = root.path("status").asText();
                String commonStatus = mapOpenAiStatusToCommon(openAiStatus);

                // Construire requestCounts depuis les données OpenAI
                Map<String, Integer> counts = new HashMap<>();
                JsonNode requestCounts = root.path("request_counts");

                if (!requestCounts.isMissingNode()) {
                    int total = requestCounts.path("total").asInt(0);
                    int completed = requestCounts.path("completed").asInt(0);
                    int failed = requestCounts.path("failed").asInt(0);

                    counts.put("processing", total - completed - failed);
                    counts.put("succeeded", completed);
                    counts.put("errored", failed);
                    counts.put("canceled", 0);
                    counts.put("expired", 0);
                } else {
                    counts.put("processing", 0);
                    counts.put("succeeded", 0);
                    counts.put("errored", 0);
                    counts.put("canceled", 0);
                    counts.put("expired", 0);
                }

                // Récupérer les timestamps
                String createdAt = null;
                if (root.has("created_at") && !root.path("created_at").isNull()) {
                    createdAt = root.path("created_at").asText();
                }

                String endedAt = null;
                if (root.has("completed_at") && !root.path("completed_at").isNull()) {
                    endedAt = root.path("completed_at").asText();
                }

                // Stocker output_file_id dans resultsUrl pour le téléchargement ultérieur
                String outputFileId = null;
                if (root.has("output_file_id") && !root.path("output_file_id").isNull()) {
                    outputFileId = root.path("output_file_id").asText();
                }

                BatchStatus status = BatchStatus.builder()
                    .id(batchId)
                    .processingStatus(commonStatus)
                    .requestCounts(counts)
                    .createdAt(createdAt)
                    .endedAt(endedAt)
                    .resultsUrl(outputFileId) // output_file_id stocké ici
                    .provider("openai")
                    .build();

                log.debug("Statut du batch OpenAI {}: {} (openai: {})", batchId, commonStatus, openAiStatus);
                return status;
            } else {
                log.error("Erreur lors de la récupération du statut OpenAI - Status: {}", response.getStatusCode());
                return null;
            }

        } catch (Exception e) {
            log.error("Erreur lors de la récupération du statut OpenAI: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * Récupère les résultats d'un batch OpenAI terminé.
     *
     * @param batchId L'ID du batch
     * @return La liste des résultats ou une liste vide en cas d'erreur
     */
    @Override
    public List<BatchResult> getBatchResults(String batchId) {
        // D'abord récupérer le statut pour obtenir output_file_id
        BatchStatus status = getBatchStatus(batchId);
        if (status == null || !status.isEnded() || status.getResultsUrl() == null) {
            if (status != null && !status.isEnded()) {
                log.info("Batch OpenAI {} pas encore terminé, statut: {}", batchId, status.getProcessingStatus());
            }
            return Collections.emptyList();
        }

        String outputFileId = status.getResultsUrl();
        return downloadAndParseResults(outputFileId);
    }

    /**
     * Annule un batch OpenAI en cours de traitement.
     *
     * @param batchId L'ID du batch à annuler
     * @return true si l'annulation a réussi, false sinon
     */
    @Override
    public boolean cancelBatch(String batchId) {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("Clé API OpenAI non configurée");
            return false;
        }

        try {
            String url = baseUrl + "/batches/" + batchId + "/cancel";

            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(apiKey);

            HttpEntity<Void> entity = new HttpEntity<>(headers);
            RestTemplate restTemplate = new RestTemplate();

            ResponseEntity<String> response = restTemplate.exchange(
                url, HttpMethod.POST, entity, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Batch OpenAI {} annulé avec succès", batchId);
                return true;
            } else {
                log.error("Erreur lors de l'annulation du batch OpenAI - Status: {}", response.getStatusCode());
                return false;
            }

        } catch (Exception e) {
            log.error("Erreur lors de l'annulation du batch OpenAI: {}", e.getMessage(), e);
            return false;
        }
    }

    // ========================================================================================
    // Méthodes internes
    // ========================================================================================

    /**
     * Convertit une liste de requêtes de recherche en format JSONL pour l'API Batch OpenAI.
     * Chaque ligne représente une requête individuelle au format :
     * {"custom_id": "...", "method": "POST", "url": "/v1/chat/completions", "body": {...}}
     */
    private String convertToJsonl(List<SearchRequest> requests) {
        StringBuilder jsonl = new StringBuilder();

        for (int i = 0; i < requests.size(); i++) {
            SearchRequest request = requests.get(i);
            String customId = request.getCustomId() != null
                ? request.getCustomId()
                : "search-" + i;

            // Construction du prompt avec le RAG
            String prompt = buildSearchPrompt(
                request.getSearchTerm(),
                request.getRagContext()
            );

            Map<String, Object> batchRequest = new LinkedHashMap<>();
            batchRequest.put("custom_id", customId);
            batchRequest.put("method", "POST");
            batchRequest.put("url", "/v1/chat/completions");

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("model", model);
            body.put("messages", List.of(
                Map.of("role", "system", "content", AiPrompts.getSystemMessage(true)),
                Map.of("role", "user", "content", prompt)
            ));
            body.put("max_tokens", maxTokens);
            body.put("temperature", temperature);

            batchRequest.put("body", body);

            try {
                jsonl.append(objectMapper.writeValueAsString(batchRequest)).append("\n");
            } catch (Exception e) {
                log.error("Erreur lors de la sérialisation de la requête {}: {}",
                    customId, e.getMessage());
            }
        }

        return jsonl.toString();
    }

    /**
     * Upload un fichier JSONL vers l'API OpenAI Files.
     *
     * @param jsonlContent Le contenu JSONL à uploader
     * @return L'ID du fichier uploadé ou null en cas d'erreur
     */
    private String uploadFile(String jsonlContent) {
        String url = baseUrl + "/files";

        try {
            // Créer un ByteArrayResource depuis le contenu JSONL
            byte[] fileBytes = jsonlContent.getBytes(StandardCharsets.UTF_8);
            ByteArrayResource fileResource = new ByteArrayResource(fileBytes) {
                @Override
                public String getFilename() {
                    return "batch-" + System.currentTimeMillis() + ".jsonl";
                }
            };

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", fileResource);
            body.add("purpose", "batch");

            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(apiKey);
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            HttpEntity<MultiValueMap<String, Object>> requestEntity =
                new HttpEntity<>(body, headers);

            RestTemplate restTemplate = new RestTemplate();
            ResponseEntity<String> response = restTemplate.postForEntity(
                url, requestEntity, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                JsonNode root = objectMapper.readTree(response.getBody());
                return root.path("id").asText();
            } else {
                log.error("Erreur lors de l'upload du fichier - Status: {}", response.getStatusCode());
                return null;
            }

        } catch (Exception e) {
            log.error("Erreur lors de l'upload du fichier JSONL: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * Crée un batch à partir d'un fichier JSONL déjà uploadé.
     *
     * @param fileId L'ID du fichier JSONL uploadé
     * @return L'ID du batch créé ou null en cas d'erreur
     */
    private String createBatchFromFile(String fileId) {
        String url = baseUrl + "/batches";

        try {
            Map<String, Object> requestBody = new LinkedHashMap<>();
            requestBody.put("input_file_id", fileId);
            requestBody.put("endpoint", "/v1/chat/completions");
            requestBody.put("completion_window", "24h");

            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(apiKey);
            headers.setContentType(MediaType.APPLICATION_JSON);

            String body = objectMapper.writeValueAsString(requestBody);
            HttpEntity<String> entity = new HttpEntity<>(body, headers);

            RestTemplate restTemplate = new RestTemplate();
            ResponseEntity<String> response = restTemplate.postForEntity(
                url, entity, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                JsonNode root = objectMapper.readTree(response.getBody());
                return root.path("id").asText();
            } else {
                log.error("Erreur lors de la création du batch OpenAI - Status: {}", response.getStatusCode());
                return null;
            }

        } catch (Exception e) {
            log.error("Erreur lors de la création du batch OpenAI: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * Télécharge et parse les résultats depuis un fichier de sortie OpenAI.
     *
     * @param outputFileId L'ID du fichier de résultats (output_file_id)
     * @return La liste des résultats parsés
     */
    private List<BatchResult> downloadAndParseResults(String outputFileId) {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("Clé API OpenAI non configurée");
            return Collections.emptyList();
        }

        try {
            String url = baseUrl + "/files/" + outputFileId + "/content";

            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(apiKey);

            HttpEntity<Void> entity = new HttpEntity<>(headers);
            RestTemplate restTemplate = new RestTemplate();

            ResponseEntity<String> response = restTemplate.exchange(
                url, HttpMethod.GET, entity, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                String jsonlContent = response.getBody();

                if (jsonlContent == null || jsonlContent.trim().isEmpty()) {
                    log.warn("Corps de réponse vide pour les résultats du batch OpenAI");
                    return Collections.emptyList();
                }

                List<BatchResult> results = parseOpenAiResults(jsonlContent);
                log.info("Récupéré {} résultats du batch OpenAI", results.size());
                return results;
            } else {
                log.error("Erreur lors du téléchargement des résultats OpenAI - Status: {}", response.getStatusCode());
                return Collections.emptyList();
            }

        } catch (Exception e) {
            log.error("Erreur lors du téléchargement des résultats OpenAI: {}", e.getMessage(), e);
            return Collections.emptyList();
        }
    }

    /**
     * Parse le contenu JSONL des résultats OpenAI en liste de BatchResult.
     *
     * Format attendu par ligne :
     * {"id": "batch_req_...", "custom_id": "...", "response": {"status_code": 200, "body": {
     *   "choices": [{"message": {"content": "..."}}], "usage": {...}}}, "error": {...}}
     */
    private List<BatchResult> parseOpenAiResults(String jsonlContent) {
        List<BatchResult> results = new ArrayList<>();
        String[] lines = jsonlContent.split("\n");

        for (String line : lines) {
            if (line == null || line.trim().isEmpty()) continue;

            try {
                JsonNode resultNode = objectMapper.readTree(line);
                String customId = resultNode.path("custom_id").asText();

                // Vérifier si la réponse est un succès ou une erreur
                JsonNode responseNode = resultNode.path("response");
                JsonNode errorNode = resultNode.path("error");

                if (!responseNode.isMissingNode() && !responseNode.isNull()) {
                    int statusCode = responseNode.path("status_code").asInt(0);
                    JsonNode body = responseNode.path("body");

                    if (statusCode == 200 && !body.isMissingNode()) {
                        // Succès : extraire le contenu de la réponse
                        String content = body.path("choices").path(0)
                            .path("message").path("content").asText("");

                        // Nettoyer la réponse JSON (enlever marqueurs markdown)
                        content = cleanJsonResponse(content);

                        JsonNode usage = body.path("usage");
                        int inputTokens = usage.path("prompt_tokens").asInt(0);
                        int outputTokens = usage.path("completion_tokens").asInt(0);

                        results.add(BatchResult.builder()
                            .customId(customId)
                            .resultType("succeeded")
                            .content(content)
                            .inputTokens(inputTokens)
                            .outputTokens(outputTokens)
                            .provider("openai")
                            .build());
                    } else {
                        // Erreur HTTP dans la réponse
                        String errorMessage = body.path("error").path("message").asText("Erreur HTTP " + statusCode);
                        String errorType = body.path("error").path("type").asText("http_error");

                        results.add(BatchResult.builder()
                            .customId(customId)
                            .resultType("errored")
                            .errorType(errorType)
                            .errorMessage(errorMessage)
                            .provider("openai")
                            .build());
                    }
                } else if (!errorNode.isMissingNode() && !errorNode.isNull()) {
                    // Erreur au niveau batch
                    results.add(BatchResult.builder()
                        .customId(customId)
                        .resultType("errored")
                        .errorType(errorNode.path("code").asText("batch_error"))
                        .errorMessage(errorNode.path("message").asText("Erreur inconnue"))
                        .provider("openai")
                        .build());
                }

            } catch (Exception e) {
                log.warn("Erreur lors du parsing d'une ligne de résultat OpenAI: {}", e.getMessage());
            }
        }

        return results;
    }

    /**
     * Mappe les statuts OpenAI vers notre modèle commun.
     *
     * OpenAI : validating | in_progress | finalizing | completed | failed | expired | cancelling | cancelled
     * Commun : in_progress | ended
     */
    private String mapOpenAiStatusToCommon(String openAiStatus) {
        return switch (openAiStatus) {
            case "validating", "in_progress", "finalizing", "cancelling" -> "in_progress";
            case "completed", "failed", "expired", "cancelled" -> "ended";
            default -> "in_progress";
        };
    }

    /**
     * Construit le prompt de recherche avec le contexte RAG.
     * Identique à la logique d'AnthropicBatchProvider pour la cohérence.
     */
    private String buildSearchPrompt(String searchTerm, String ragContext) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("En utilisant la liste suivante : \n\n");

        if (ragContext != null && !ragContext.isEmpty()) {
            prompt.append(ragContext);
        } else {
            prompt.append("[Contexte non fourni]");
        }

        prompt.append("\n\n")
              .append("Recherchez tous les items qui contiennent la catégorie qui correspond à : \"")
              .append(searchTerm)
              .append("\".\n")
              .append("L'aspect qui nous intéresse est la valeur du code.");

        return prompt.toString();
    }

    /**
     * Nettoie la réponse JSON en enlevant les marqueurs markdown si présents.
     * Les LLMs retournent parfois le JSON enveloppé dans des blocs markdown ```json
     */
    private String cleanJsonResponse(String response) {
        if (response == null || response.isEmpty()) {
            return response;
        }

        String cleaned = response.trim();

        if (cleaned.startsWith("```json")) {
            cleaned = cleaned.substring(7);
        } else if (cleaned.startsWith("```")) {
            cleaned = cleaned.substring(3);
        }

        if (cleaned.endsWith("```")) {
            cleaned = cleaned.substring(0, cleaned.length() - 3);
        }

        return cleaned.trim();
    }
}
