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
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String apiKey;
    private final String model;
    private final String fastModel;
    private final String apiUrl;
    private final double baseRequestPrice;
    private final double priceInputPerMillion;
    private final double priceOutputPerMillion;
    private final float temperature = 0.1F;
    private volatile boolean fastModelDisabled = false;

    private static final ThreadLocal<UsageInfo> currentUsage = new ThreadLocal<>();

    @org.springframework.beans.factory.annotation.Autowired
    public AnthropicService(
            RestTemplate restTemplate,
            @Value("${ai.anthropic.api-key:}") String apiKey,
            @Value("${ai.anthropic.model:claude-haiku-4-5-20251001}") String model,
            @Value("${ai.anthropic.fast-model:claude-haiku-4-5-20251001}") String fastModel,
            @Value("${ai.anthropic.base-url:https://api.anthropic.com/v1}") String baseUrl,
            @Value("${ai.base-request-price:0.01}") double baseRequestPrice,
            @Value("${ai.anthropic.price-input-per-million:3.00}") double priceInputPerMillion,
            @Value("${ai.anthropic.price-output-per-million:15.00}") double priceOutputPerMillion) {
        this.restTemplate = restTemplate;
        this.apiKey = apiKey;
        this.model = model;
        this.fastModel = (fastModel != null && !fastModel.isBlank()) ? fastModel.trim() : model;
        this.apiUrl = baseUrl + "/messages";
        this.baseRequestPrice = baseRequestPrice;
        this.priceInputPerMillion = priceInputPerMillion;
        this.priceOutputPerMillion = priceOutputPerMillion;
        log.info("AnthropicService initialisé avec le modèle: {} (fastModel: {}, tarifs: input=${}/M, output=${}/M)",
                model, this.fastModel, priceInputPerMillion, priceOutputPerMillion);
    }

    public AnthropicService(
            RestTemplate restTemplate,
            String apiKey,
            String model,
            String baseUrl,
            double baseRequestPrice,
            double priceInputPerMillion,
            double priceOutputPerMillion) {
        this(restTemplate, apiKey, model, model, baseUrl, baseRequestPrice, priceInputPerMillion, priceOutputPerMillion);
    }

    @Override
    public String demanderAiAide(String titre, String question, boolean withJustification, String niveau) {
        return demanderAiAide(titre, question, withJustification, niveau, false);
    }

    @Override
    public String demanderAiAide(String titre, String question, boolean withJustification, String niveau, boolean allowFastModel) {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("Clé API Anthropic non configurée");
            return "";
        }

        boolean useFastModel = allowFastModel
                && !fastModelDisabled
                && ("SECTIONS".equals(niveau) || "CHAPITRES".equals(niveau))
                && fastModel != null && !fastModel.isBlank()
                && !fastModel.equals(model);
        String effectiveModel = useFastModel ? fastModel : model;

        HttpHeaders httpHeaders = new HttpHeaders();
        httpHeaders.add("x-api-key", apiKey);
        httpHeaders.add("Content-Type", "application/json");
        httpHeaders.add("anthropic-version", "2023-06-01");

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", effectiveModel);
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

                    // Nettoyer la réponse : enlever les marqueurs markdown ```json si présents
                    String cleanedMessage = cleanJsonResponse(assistantMessage);

                    // Récupérer les tokens si disponibles
                    int inputTokens = rootNode.path("usage").path("input_tokens").asInt(0);
                    int outputTokens = rootNode.path("usage").path("output_tokens").asInt(0);
                    double tokenCostUsd = (inputTokens * priceInputPerMillion + outputTokens * priceOutputPerMillion) / 1_000_000.0;

                    UsageInfo usageInfo = new UsageInfo(
                            inputTokens + outputTokens,
                            baseRequestPrice,
                            inputTokens,
                            outputTokens,
                            tokenCostUsd
                    );
                    currentUsage.set(UsageInfo.accumulate(currentUsage.get(), usageInfo));

                    return cleanedMessage;
                }
            }

            log.warn("Structure de réponse inattendue: {}", responseBody);
            return "";

        } catch (org.springframework.web.client.HttpClientErrorException e) {
            if (useFastModel && isModelNotFoundError(e)) {
                fastModelDisabled = true;
                log.warn("Modèle rapide '{}' indisponible (404/déprécié) — désactivation automatique et repli immédiat sur '{}'",
                        fastModel, model);
                return demanderAiAide(titre, question, withJustification, niveau, false);
            }
            log.error("Erreur HTTP API Anthropic - Status: {}, Body: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new AiProviderException("Erreur HTTP Anthropic: " + e.getStatusCode(), e);
        } catch (Exception e) {
            if (useFastModel && isModelNotFoundError(e)) {
                fastModelDisabled = true;
                log.warn("Modèle rapide '{}' indisponible (404/déprécié) — désactivation automatique et repli immédiat sur '{}'",
                        fastModel, model);
                return demanderAiAide(titre, question, withJustification, niveau, false);
            }
            log.error("Erreur lors de la requête à l'API Anthropic: {}", e.getMessage(), e);
            throw new AiProviderException("Erreur Anthropic: " + e.getMessage(), e);
        }
    }

    private static boolean isModelNotFoundError(Exception e) {
        if (e instanceof org.springframework.web.client.HttpClientErrorException.NotFound) {
            return true;
        }
        String msg = e.getMessage();
        return msg != null && (msg.contains("model_not_found") || msg.contains("deprecated"));
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
