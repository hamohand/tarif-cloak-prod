package com.tarif.search.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tarif.search.model.UsageInfo;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Service
@Slf4j
public class AnthropicService implements AiProvider {

    private final String apiKey;
    private final String model;
    private final String apiUrl;
    private final int maxTokens = 4096;
    private final float temperature = 0.1F;

    private static final ThreadLocal<UsageInfo> currentUsage = new ThreadLocal<>();

    public AnthropicService(
            @Value("${ai.anthropic.api-key:}") String apiKey,
            @Value("${ai.anthropic.model:claude-sonnet-4-5-20250929}") String model,
            @Value("${ai.anthropic.base-url:https://api.anthropic.com/v1}") String baseUrl) {
        this.apiKey = apiKey;
        this.model = model;
        this.apiUrl = baseUrl + "/messages";
        log.info("AnthropicService initialisé avec le modèle: {}", model);
    }

    @Override
    public String demanderAiAide(String titre, String question) {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("Clé API Anthropic non configurée");
            return "";
        }

        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders httpHeaders = new HttpHeaders();
        httpHeaders.add("x-api-key", apiKey);
        httpHeaders.add("Content-Type", "application/json");
        httpHeaders.add("anthropic-version", "2023-06-01");

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", model);
        requestBody.put("system", AiPrompts.getSystemMessage(true));
        requestBody.put("messages", new Object[]{
                Map.of("role", "user", "content", question)
        });
        requestBody.put("max_tokens", maxTokens);
        requestBody.put("temperature", temperature);

        ObjectMapper objectMapper = new ObjectMapper();
        String body;
        try {
            body = objectMapper.writeValueAsString(requestBody);
        } catch (Exception e) {
            log.error("Erreur lors de la sérialisation JSON", e);
            return "";
        }

        HttpEntity<String> entity = new HttpEntity<>(body, httpHeaders);
        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    apiUrl,
                    HttpMethod.POST,
                    entity,
                    String.class
            );

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

                    // Récupérer les tokens si disponibles
                    int inputTokens = rootNode.path("usage").path("input_tokens").asInt(0);
                    int outputTokens = rootNode.path("usage").path("output_tokens").asInt(0);

                    UsageInfo usageInfo = new UsageInfo(
                            inputTokens + outputTokens,
                            0.01,
                            inputTokens,
                            outputTokens,
                            0.0
                    );
                    currentUsage.set(usageInfo);

                    return assistantMessage;
                }
            }

            log.warn("Structure de réponse inattendue: {}", responseBody);
            return "";

        } catch (org.springframework.web.client.HttpClientErrorException e) {
            log.error("Erreur HTTP API Anthropic - Status: {}, Body: {}", e.getStatusCode(), e.getResponseBodyAsString());
            currentUsage.remove();
            return "";
        } catch (Exception e) {
            log.error("Erreur lors de la requête à l'API Anthropic: {}", e.getMessage(), e);
            currentUsage.remove();
            return "";
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
}
