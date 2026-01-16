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
public class OpenAiService implements AiProvider {

    private final AiPrompts aiPrompts;
    private final String apiKey;
    private final String apiUrl;
    private final String model;
    private final double baseRequestPrice;
    private final int maxTokens = 500;
    private final float temperature = 0.0F;

    private static final ThreadLocal<UsageInfo> currentUsage = new ThreadLocal<>();

    public OpenAiService(
            AiPrompts aiPrompts,
            @Value("${ai.openai.api-key:}") String apiKey,
            @Value("${ai.openai.base-url:https://api.openai.com/v1}") String baseUrl,
            @Value("${ai.openai.model:gpt-4o-mini}") String model,
            @Value("${ai.base-request-price:0.01}") double baseRequestPrice) {
        this.aiPrompts = aiPrompts;
        this.apiKey = apiKey;
        this.apiUrl = baseUrl + "/chat/completions";
        this.model = model;
        this.baseRequestPrice = baseRequestPrice;
        log.info("OpenAiService initialisé avec le modèle: {}", model);
    }

    @Override
    public String demanderAiAide(String titre, String question) {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("Clé API OpenAI non configurée");
            return "";
        }

        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders httpHeaders = new HttpHeaders();
        httpHeaders.add("Authorization", "Bearer " + apiKey);
        httpHeaders.add("Content-Type", "application/json");

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", model);
        requestBody.put("messages", new Object[]{
                Map.of("role", "system", "content", AiPrompts.getSystemMessage(aiPrompts.getDefTheme().isWithJustification())),
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
                log.error("Erreur API OpenAI - Status: {}, Body: {}", response.getStatusCode(), response.getBody());
                return "";
            }

            String responseBody = response.getBody();
            if (responseBody == null) {
                return "";
            }

            JsonNode rootNode = objectMapper.readTree(responseBody);
            String assistantMessage = rootNode
                    .path("choices")
                    .get(0)
                    .path("message")
                    .path("content")
                    .asText();

            int promptTokens = rootNode.path("usage").path("prompt_tokens").asInt();
            int completionTokens = rootNode.path("usage").path("completion_tokens").asInt();
            int totalTokens = rootNode.path("usage").path("total_tokens").asInt();

            // Tarifs GPT-4o mini (USD)
            final double PRICE_INPUT_USD = 0.15 / 1_000_000;
            final double PRICE_OUTPUT_USD = 0.60 / 1_000_000;

            double tokenCostUsd = (promptTokens * PRICE_INPUT_USD) + (completionTokens * PRICE_OUTPUT_USD);

            UsageInfo usageInfo = new UsageInfo(
                    totalTokens,
                    baseRequestPrice,
                    promptTokens,
                    completionTokens,
                    tokenCostUsd
            );
            currentUsage.set(usageInfo);

            log.debug("Niveau: {}, Tokens: {}, Coût: {}", titre, totalTokens, tokenCostUsd);

            return assistantMessage;

        } catch (Exception e) {
            log.error("Erreur lors de la requête à l'API OpenAI: {}", e.getMessage());
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
