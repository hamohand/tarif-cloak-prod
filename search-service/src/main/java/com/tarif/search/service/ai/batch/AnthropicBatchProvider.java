package com.tarif.search.service.ai.batch;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tarif.search.service.ai.AiPrompts;
import com.tarif.search.service.ai.batch.models.BatchResult;
import com.tarif.search.service.ai.batch.models.BatchStatus;
import com.tarif.search.service.ai.batch.models.SearchRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * Implémentation du provider de batch pour Anthropic.
 * Cette API permet de traiter plusieurs requêtes de manière asynchrone avec une réduction de 50% du coût.
 *
 * Cas d'usage :
 * - Import de fichiers avec plusieurs produits
 * - Analyse de catalogues entiers
 * - Traitements nocturnes ou en arrière-plan
 */
@Service
@Slf4j
public class AnthropicBatchProvider implements BatchProvider {

    private final String apiKey;
    private final String model;
    private final String batchApiUrl;
    private final ObjectMapper objectMapper;
    private final int maxTokens = 4096;
    private final float temperature = 0.1F;

    public AnthropicBatchProvider(
            @Value("${ai.anthropic.api-key:}") String apiKey,
            @Value("${ai.anthropic.model:claude-sonnet-4-5-20250929}") String model,
            @Value("${ai.anthropic.base-url:https://api.anthropic.com/v1}") String baseUrl) {
        this.apiKey = apiKey;
        this.model = model;
        this.batchApiUrl = baseUrl + "/messages/batches";
        this.objectMapper = new ObjectMapper();
        log.info("AnthropicBatchProvider initialisé avec le modèle: {}", model);
    }

    /**
     * Crée un batch de requêtes pour rechercher plusieurs codes HS.
     *
     * @param searchRequests Liste des requêtes de recherche avec leurs contextes RAG
     * @return L'ID du batch créé ou null en cas d'erreur
     */
    @Override
    public String createBatch(List<SearchRequest> searchRequests) {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("Clé API Anthropic non configurée");
            return null;
        }

        if (searchRequests == null || searchRequests.isEmpty()) {
            log.error("Liste de requêtes vide");
            return null;
        }

        try {
            // Construire les requêtes individuelles au format Anthropic Batch
            List<Map<String, Object>> requests = new ArrayList<>();

            for (int i = 0; i < searchRequests.size(); i++) {
                SearchRequest searchRequest = searchRequests.get(i);
                String customId = searchRequest.getCustomId() != null
                    ? searchRequest.getCustomId()
                    : "search-" + i;

                // Construction du prompt avec le RAG
                String prompt = buildSearchPrompt(
                    searchRequest.getSearchTerm(),
                    searchRequest.getRagContext()
                );

                Map<String, Object> request = new HashMap<>();
                request.put("custom_id", customId);

                Map<String, Object> params = new HashMap<>();
                params.put("model", model);
                params.put("max_tokens", maxTokens);
                params.put("temperature", temperature);
                params.put("system", AiPrompts.getSystemMessage(true));
                params.put("messages", List.of(
                    Map.of("role", "user", "content", prompt)
                ));

                request.put("params", params);
                requests.add(request);
            }

            // Créer le batch
            Map<String, Object> batchRequest = Map.of("requests", requests);

            HttpHeaders headers = new HttpHeaders();
            headers.add("x-api-key", apiKey);
            headers.add("Content-Type", "application/json");
            headers.add("anthropic-version", "2023-06-01");

            String body = objectMapper.writeValueAsString(batchRequest);
            HttpEntity<String> entity = new HttpEntity<>(body, headers);

            RestTemplate restTemplate = new RestTemplate();
            ResponseEntity<String> response = restTemplate.exchange(
                batchApiUrl,
                HttpMethod.POST,
                entity,
                String.class
            );

            if (response.getStatusCode().is2xxSuccessful()) {
                JsonNode responseNode = objectMapper.readTree(response.getBody());
                String batchId = responseNode.path("id").asText();
                log.info("Batch créé avec succès: {} ({} requêtes)", batchId, requests.size());
                return batchId;
            } else {
                log.error("Erreur lors de la création du batch - Status: {}", response.getStatusCode());
                return null;
            }

        } catch (Exception e) {
            log.error("Erreur lors de la création du batch: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * Récupère le statut d'un batch.
     *
     * @param batchId L'ID du batch
     * @return Le statut du batch ou null en cas d'erreur
     */
    @Override
    public BatchStatus getBatchStatus(String batchId) {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("Clé API Anthropic non configurée");
            return null;
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.add("x-api-key", apiKey);
            headers.add("anthropic-version", "2023-06-01");

            HttpEntity<String> entity = new HttpEntity<>(headers);
            RestTemplate restTemplate = new RestTemplate();

            ResponseEntity<String> response = restTemplate.exchange(
                batchApiUrl + "/" + batchId,
                HttpMethod.GET,
                entity,
                String.class
            );

            if (response.getStatusCode().is2xxSuccessful()) {
                JsonNode node = objectMapper.readTree(response.getBody());

                BatchStatus status = BatchStatus.builder()
                    .id(node.path("id").asText())
                    .processingStatus(node.path("processing_status").asText())
                    .createdAt(node.path("created_at").asText())
                    .endedAt(node.path("ended_at").asText(null))
                    .resultsUrl(node.path("results_url").asText(null))
                    .provider("anthropic") // Ajout du provider
                    .build();

                // Récupérer les compteurs de requêtes
                JsonNode countsNode = node.path("request_counts");
                Map<String, Integer> requestCounts = new HashMap<>();
                requestCounts.put("processing", countsNode.path("processing").asInt(0));
                requestCounts.put("succeeded", countsNode.path("succeeded").asInt(0));
                requestCounts.put("errored", countsNode.path("errored").asInt(0));
                requestCounts.put("canceled", countsNode.path("canceled").asInt(0));
                requestCounts.put("expired", countsNode.path("expired").asInt(0));
                status.setRequestCounts(requestCounts);

                log.debug("Statut du batch {}: {}", batchId, status.getProcessingStatus());
                return status;
            } else {
                log.error("Erreur lors de la récupération du statut - Status: {}", response.getStatusCode());
                return null;
            }

        } catch (Exception e) {
            log.error("Erreur lors de la récupération du statut: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * Récupère les résultats d'un batch terminé.
     *
     * @param batchId L'ID du batch
     * @return La liste des résultats ou une liste vide en cas d'erreur
     */
    @Override
    public List<BatchResult> getBatchResults(String batchId) {
        // D'abord récupérer le statut pour obtenir resultsUrl
        BatchStatus status = getBatchStatus(batchId);
        if (status == null || !status.isEnded() || status.getResultsUrl() == null) {
            if (status != null && !status.isEnded()) {
                log.info("Batch {} pas encore terminé, statut: {}", batchId, status.getProcessingStatus());
            }
            return Collections.emptyList();
        }

        return downloadAndParseResults(status.getResultsUrl());
    }

    /**
     * Télécharge et parse les résultats depuis l'URL fournie.
     * Méthode interne extraite pour réutilisabilité.
     */
    private List<BatchResult> downloadAndParseResults(String resultsUrl) {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("Clé API Anthropic non configurée");
            return Collections.emptyList();
        }

        if (resultsUrl == null || resultsUrl.isBlank()) {
            log.error("URL de résultats non fournie");
            return Collections.emptyList();
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.add("x-api-key", apiKey);
            headers.add("anthropic-version", "2023-06-01");

            HttpEntity<String> entity = new HttpEntity<>(headers);
            RestTemplate restTemplate = new RestTemplate();

            ResponseEntity<String> response = restTemplate.exchange(
                resultsUrl,
                HttpMethod.GET,
                entity,
                String.class
            );

            if (response.getStatusCode().is2xxSuccessful()) {
                List<BatchResult> results = new ArrayList<>();
                String responseBody = response.getBody();

                if (responseBody == null || responseBody.trim().isEmpty()) {
                    log.warn("Corps de réponse vide pour les résultats du batch");
                    return Collections.emptyList();
                }

                // Les résultats sont en format JSONL (une ligne JSON par résultat)
                String[] lines = responseBody.split("\n");

                for (String line : lines) {
                    if (line != null && !line.trim().isEmpty()) {
                        try {
                            JsonNode resultNode = objectMapper.readTree(line);

                            String customId = resultNode.path("custom_id").asText();
                            JsonNode resultContent = resultNode.path("result");
                            String resultType = resultContent.path("type").asText();

                            BatchResult result = BatchResult.builder()
                                .customId(customId)
                                .resultType(resultType)
                                .provider("anthropic") // Ajout du provider
                                .build();

                            // Extraire le contenu selon le type de résultat
                            if ("succeeded".equals(resultType)) {
                                JsonNode messageContent = resultContent.path("message")
                                    .path("content");
                                if (messageContent.isArray() && messageContent.size() > 0) {
                                    String rawContent = messageContent.get(0).path("text").asText();
                                    // Nettoyer la réponse : enlever les marqueurs markdown ```json si présents
                                    String cleanedContent = cleanJsonResponse(rawContent);
                                    result.setContent(cleanedContent);
                                }

                                // Extraire les informations d'utilisation
                                JsonNode usage = resultContent.path("message").path("usage");
                                result.setInputTokens(usage.path("input_tokens").asInt(0));
                                result.setOutputTokens(usage.path("output_tokens").asInt(0));
                            } else if ("errored".equals(resultType)) {
                                JsonNode error = resultContent.path("error");
                                result.setErrorType(error.path("type").asText());
                                result.setErrorMessage(error.path("message").asText());
                            }

                            results.add(result);
                        } catch (Exception e) {
                            log.warn("Erreur lors du parsing d'une ligne de résultat: {}", e.getMessage());
                        }
                    }
                }

                log.info("Récupéré {} résultats du batch", results.size());
                return results;
            } else {
                log.error("Erreur lors de la récupération des résultats - Status: {}", response.getStatusCode());
                return Collections.emptyList();
            }

        } catch (Exception e) {
            log.error("Erreur lors de la récupération des résultats: {}", e.getMessage(), e);
            return Collections.emptyList();
        }
    }

    /**
     * Annule un batch en cours de traitement.
     *
     * @param batchId L'ID du batch à annuler
     * @return true si l'annulation a réussi, false sinon
     */
    @Override
    public boolean cancelBatch(String batchId) {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("Clé API Anthropic non configurée");
            return false;
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.add("x-api-key", apiKey);
            headers.add("anthropic-version", "2023-06-01");

            HttpEntity<String> entity = new HttpEntity<>(headers);
            RestTemplate restTemplate = new RestTemplate();

            ResponseEntity<String> response = restTemplate.exchange(
                batchApiUrl + "/" + batchId + "/cancel",
                HttpMethod.POST,
                entity,
                String.class
            );

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Batch {} annulé avec succès", batchId);
                return true;
            } else {
                log.error("Erreur lors de l'annulation du batch - Status: {}", response.getStatusCode());
                return false;
            }

        } catch (Exception e) {
            log.error("Erreur lors de l'annulation du batch: {}", e.getMessage(), e);
            return false;
        }
    }

    /**
     * Construit le prompt de recherche avec le contexte RAG.
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
     * Claude retourne parfois le JSON enveloppé dans des blocs markdown ```json
     *
     * @param response La réponse brute de l'API
     * @return Le JSON nettoyé
     */
    private String cleanJsonResponse(String response) {
        if (response == null || response.isEmpty()) {
            return response;
        }

        String cleaned = response.trim();

        // Enlever les marqueurs markdown ```json et ```
        if (cleaned.startsWith("```json")) {
            cleaned = cleaned.substring(7); // Enlever "```json"
        } else if (cleaned.startsWith("```")) {
            cleaned = cleaned.substring(3); // Enlever "```"
        }

        if (cleaned.endsWith("```")) {
            cleaned = cleaned.substring(0, cleaned.length() - 3); // Enlever "```" à la fin
        }

        return cleaned.trim();
    }
}
