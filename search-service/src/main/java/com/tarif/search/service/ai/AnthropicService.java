package com.tarif.search.service.ai;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tarif.search.model.UsageInfo;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class AnthropicService implements AiProvider {

    private final RestTemplate restTemplate;
    private final String apiKey;
    private final String model;
    private final String fastModel;
    private final String apiUrl;
    private final float temperature = 0.1F;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final ThreadLocal<UsageInfo> currentUsage = new ThreadLocal<>();

    public AnthropicService(
            RestTemplate restTemplate,
            @Value("${ai.anthropic.api-key:}") String apiKey,
            @Value("${ai.anthropic.model:claude-haiku-4-5-20251001}") String model,
            @Value("${ai.anthropic.fast-model:claude-haiku-4-5-20251001}") String fastModel,
            @Value("${ai.anthropic.base-url:https://api.anthropic.com/v1}") String baseUrl) {
        this.restTemplate = restTemplate;
        this.apiKey = apiKey;
        this.model = model;
        this.fastModel = fastModel;
        this.apiUrl = baseUrl + "/messages";
        log.info("AnthropicService initialisé avec model={} et fastModel={}", model, fastModel);
    }

    @Override
    public String demanderAiAide(String titre, String question, boolean withJustification, String niveau) {
        return demanderAiAide(titre, question, withJustification, niveau, true);
    }

    @Override
    public String demanderAiAide(String titre, String question, boolean withJustification, String niveau, boolean allowFastModel) {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("Clé API Anthropic non configurée");
            return "";
        }

        String selectedModel = AiProvider.shouldUseFastModel(allowFastModel, withJustification, fastModel, niveau)
                ? fastModel
                : model;

        HttpHeaders httpHeaders = new HttpHeaders();
        httpHeaders.add("x-api-key", apiKey);
        httpHeaders.add("Content-Type", "application/json");
        httpHeaders.add("anthropic-version", "2023-06-01");

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", selectedModel);
        requestBody.put("system", AiPrompts.getSystemMessage(withJustification, niveau));
        requestBody.put("messages", new Object[]{
                Map.of("role", "user", "content", question)
        });
        int maxTokens = AiPrompts.getMaxTokensForLevel(withJustification);
        requestBody.put("max_tokens", maxTokens);
        requestBody.put("temperature", temperature);

        String body;
        try {
            body = objectMapper.writeValueAsString(requestBody);
        } catch (Exception e) {
            log.error("Erreur lors de la sérialisation JSON", e);
            return "";
        }

        HttpEntity<String> entity = new HttpEntity<>(body, httpHeaders);
        long startMs = System.currentTimeMillis();
        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    apiUrl,
                    HttpMethod.POST,
                    entity,
                    String.class
            );
            long elapsedMs = System.currentTimeMillis() - startMs;

            if (!response.getStatusCode().is2xxSuccessful()) {
                log.error("Erreur API Anthropic - Status: {}, Body: {}", response.getStatusCode(), response.getBody());
                return "";
            }

            String responseBody = response.getBody();
            if (responseBody == null) {
                return "";
            }

            JsonNode rootNode = objectMapper.readTree(responseBody);

            if (rootNode.has("content")) {
                JsonNode contentNode = rootNode.path("content");
                if (contentNode.isArray() && !contentNode.isEmpty()) {
                    String assistantMessage = contentNode.get(0).path("text").asText();

                    // Nettoyer la réponse : enlever les marqueurs markdown ```json si présents
                    String cleanedMessage = cleanJsonResponse(assistantMessage);

                    // Récupérer les tokens si disponibles
                    int inputTokens = rootNode.path("usage").path("input_tokens").asInt(0);
                    int outputTokens = rootNode.path("usage").path("output_tokens").asInt(0);

                    AiProvider.accumulateUsage(currentUsage, inputTokens, outputTokens, inputTokens + outputTokens, 0.01, 0.0);

                    log.info("[PERF] Anthropic {} (model={}) en {} ms — tokens: input={}, output={}",
                            titre, selectedModel, elapsedMs, inputTokens, outputTokens);

                    return cleanedMessage;
                }
            }

            log.warn("Structure de réponse inattendue: {}", responseBody);
            return "";

        } catch (org.springframework.web.client.HttpClientErrorException e) {
            long elapsedMs = System.currentTimeMillis() - startMs;
            log.error("Erreur HTTP API Anthropic (model={}, {} ms) - Status: {}, Body: {}", selectedModel, elapsedMs, e.getStatusCode(), e.getResponseBodyAsString());
            throw new AiProviderException("Erreur HTTP Anthropic: " + e.getStatusCode(), e);
        } catch (Exception e) {
            long elapsedMs = System.currentTimeMillis() - startMs;
            log.error("Erreur lors de la requête à l'API Anthropic (model={}, {} ms): {}", selectedModel, elapsedMs, e.getMessage(), e);
            throw new AiProviderException("Erreur Anthropic: " + e.getMessage(), e);
        }
    }

    @Override
    public UsageInfo getLastUsageInfo() {
        return currentUsage.get();
    }

    @Override
    public void clearUsageInfo() {
        currentUsage.remove();
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
