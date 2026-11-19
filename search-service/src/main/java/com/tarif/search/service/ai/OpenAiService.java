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
public class OpenAiService implements AiProvider {

    private final AiPrompts aiPrompts;
    private final RestTemplate restTemplate;
    private final String apiKey;
    private final String apiUrl;
    private final String model;
    private final String fastModel;
    private final double baseRequestPrice;
    private final double priceInputPerMillion;
    private final double priceOutputPerMillion;
    private final double fastPriceInputPerMillion;
    private final double fastPriceOutputPerMillion;
    private final float temperature = 0.0F;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final ThreadLocal<UsageInfo> currentUsage = new ThreadLocal<>();

    public OpenAiService(
            AiPrompts aiPrompts,
            RestTemplate restTemplate,
            @Value("${ai.openai.api-key:}") String apiKey,
            @Value("${ai.openai.base-url:https://api.openai.com/v1}") String baseUrl,
            @Value("${ai.openai.model:gpt-4.1-mini}") String model,
            @Value("${ai.openai.fast-model:gpt-4.1-nano}") String fastModel,
            @Value("${ai.base-request-price:0.01}") double baseRequestPrice,
            @Value("${ai.openai.price-input-per-million:0.40}") double priceInputPerMillion,
            @Value("${ai.openai.price-output-per-million:1.60}") double priceOutputPerMillion,
            @Value("${ai.openai.fast-price-input-per-million:0.10}") double fastPriceInputPerMillion,
            @Value("${ai.openai.fast-price-output-per-million:0.40}") double fastPriceOutputPerMillion) {
        this.aiPrompts = aiPrompts;
        this.restTemplate = restTemplate;
        this.apiKey = apiKey;
        this.apiUrl = baseUrl + "/chat/completions";
        this.model = model;
        this.fastModel = fastModel;
        this.baseRequestPrice = baseRequestPrice;
        this.priceInputPerMillion = priceInputPerMillion;
        this.priceOutputPerMillion = priceOutputPerMillion;
        this.fastPriceInputPerMillion = fastPriceInputPerMillion;
        this.fastPriceOutputPerMillion = fastPriceOutputPerMillion;
        log.info("OpenAiService initialisé avec model={} (input=${}/M, output=${}/M) et fastModel={} (input=${}/M, output=${}/M)",
                model, priceInputPerMillion, priceOutputPerMillion,
                fastModel, fastPriceInputPerMillion, fastPriceOutputPerMillion);
    }

    @Override
    public String demanderAiAide(String titre, String question, boolean withJustification, String niveau) {
        return demanderAiAide(titre, question, withJustification, niveau, true);
    }

    @Override
    public String demanderAiAide(String titre, String question, boolean withJustification, String niveau, boolean allowFastModel) {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("Clé API OpenAI non configurée");
            return "";
        }

        boolean useFast = AiProvider.shouldUseFastModel(allowFastModel, withJustification, fastModel, niveau);
        String selectedModel = useFast ? fastModel : model;
        double inputPrice = useFast ? fastPriceInputPerMillion : priceInputPerMillion;
        double outputPrice = useFast ? fastPriceOutputPerMillion : priceOutputPerMillion;

        HttpHeaders httpHeaders = new HttpHeaders();
        httpHeaders.add("Authorization", "Bearer " + apiKey);
        httpHeaders.add("Content-Type", "application/json");

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", selectedModel);
        requestBody.put("messages", new Object[]{
                Map.of("role", "system", "content", AiPrompts.getSystemMessage(withJustification, niveau)),
                Map.of("role", "user", "content", question)
        });
        int maxTokens = AiPrompts.getMaxTokensForLevel(withJustification);
        boolean isReasoningModel = selectedModel.startsWith("gpt-5")
                || selectedModel.startsWith("o1")
                || selectedModel.startsWith("o3")
                || selectedModel.startsWith("o4");
        if (isReasoningModel) {
            requestBody.put("max_completion_tokens", maxTokens);
        } else {
            requestBody.put("max_tokens", maxTokens);
            requestBody.put("temperature", temperature);
        }
        requestBody.put("response_format", Map.of("type", "json_object"));

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

            double tokenCostUsd = (promptTokens * inputPrice + completionTokens * outputPrice) / 1_000_000;

            AiProvider.accumulateUsage(currentUsage, promptTokens, completionTokens, totalTokens, baseRequestPrice, tokenCostUsd);

            log.info("[PERF] OpenAI {} (model={}) en {} ms — tokens: prompt={}, completion={}, total={}",
                    titre, selectedModel, elapsedMs, promptTokens, completionTokens, totalTokens);

            return assistantMessage;

        } catch (Exception e) {
            long elapsedMs = System.currentTimeMillis() - startMs;
            log.error("Erreur lors de la requête à l'API OpenAI (model={}, {} ms): {}", selectedModel, elapsedMs, e.getMessage());
            throw new AiProviderException("Erreur OpenAI: " + e.getMessage(), e);
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
