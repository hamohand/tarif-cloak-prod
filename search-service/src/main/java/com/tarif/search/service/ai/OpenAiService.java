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
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String apiKey;
    private final String apiUrl;
    private final String model;
    private final String reasoningEffort;
    private final String fastModel;
    private final String fastReasoningEffort;
    private final double baseRequestPrice;
    private final double priceInputPerMillion;
    private final double priceOutputPerMillion;
    private final double fastPriceInputPerMillion;
    private final double fastPriceOutputPerMillion;
    private final float temperature = 0.0F;
    private volatile boolean fastModelDisabled = false;

    private static final ThreadLocal<UsageInfo> currentUsage = new ThreadLocal<>();

    @org.springframework.beans.factory.annotation.Autowired
    public OpenAiService(
            AiPrompts aiPrompts,
            RestTemplate restTemplate,
            @Value("${ai.openai.api-key:}") String apiKey,
            @Value("${ai.openai.base-url:https://api.openai.com/v1}") String baseUrl,
            @Value("${ai.openai.model:gpt-4.1-mini}") String model,
            @Value("${ai.openai.reasoning-effort:}") String reasoningEffort,
            @Value("${ai.openai.fast-model:gpt-6-luna}") String fastModel,
            @Value("${ai.openai.fast-reasoning-effort:low}") String fastReasoningEffort,
            @Value("${ai.base-request-price:0.01}") double baseRequestPrice,
            @Value("${ai.openai.price-input-per-million:0.40}") double priceInputPerMillion,
            @Value("${ai.openai.price-output-per-million:1.60}") double priceOutputPerMillion,
            @Value("${ai.openai.fast-price-input-per-million:0.10}") double fastPriceInputPerMillion,
            @Value("${ai.openai.fast-price-output-per-million:0.50}") double fastPriceOutputPerMillion) {
        this.aiPrompts = aiPrompts;
        this.restTemplate = restTemplate;
        this.apiKey = apiKey;
        this.apiUrl = baseUrl + "/chat/completions";
        this.model = model;
        this.reasoningEffort = reasoningEffort != null ? reasoningEffort.trim() : "";
        this.fastModel = (fastModel != null && !fastModel.isBlank()) ? fastModel.trim() : model;
        this.fastReasoningEffort = fastReasoningEffort != null ? fastReasoningEffort.trim() : "";
        this.baseRequestPrice = baseRequestPrice;
        this.priceInputPerMillion = priceInputPerMillion;
        this.priceOutputPerMillion = priceOutputPerMillion;
        this.fastPriceInputPerMillion = fastPriceInputPerMillion;
        this.fastPriceOutputPerMillion = fastPriceOutputPerMillion;
        log.info("OpenAiService initialisé avec le modèle: {} (fastModel: {}, fastReasoningEffort: {}, tarifs: input=${}/M, output=${}/M)",
                model, this.fastModel, this.fastReasoningEffort, priceInputPerMillion, priceOutputPerMillion);
    }

    public OpenAiService(
            AiPrompts aiPrompts,
            RestTemplate restTemplate,
            String apiKey,
            String baseUrl,
            String model,
            String fastModel,
            double baseRequestPrice,
            double priceInputPerMillion,
            double priceOutputPerMillion,
            double fastPriceInputPerMillion,
            double fastPriceOutputPerMillion) {
        this(aiPrompts, restTemplate, apiKey, baseUrl, model, "", fastModel, "low",
                baseRequestPrice, priceInputPerMillion, priceOutputPerMillion,
                fastPriceInputPerMillion, fastPriceOutputPerMillion);
    }

    public OpenAiService(
            AiPrompts aiPrompts,
            RestTemplate restTemplate,
            String apiKey,
            String baseUrl,
            String model,
            double baseRequestPrice,
            double priceInputPerMillion,
            double priceOutputPerMillion) {
        this(aiPrompts, restTemplate, apiKey, baseUrl, model, "", model, "",
                baseRequestPrice, priceInputPerMillion, priceOutputPerMillion,
                priceInputPerMillion, priceOutputPerMillion);
    }

    @Override
    public String demanderAiAide(String titre, String question, boolean withJustification, String niveau) {
        return demanderAiAide(titre, question, withJustification, niveau, false);
    }

    @Override
    public String demanderAiAide(String titre, String question, boolean withJustification, String niveau, boolean allowFastModel) {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("Clé API OpenAI non configurée");
            return "";
        }

        boolean useFastModel = allowFastModel
                && !fastModelDisabled
                && ("SECTIONS".equals(niveau) || "CHAPITRES".equals(niveau))
                && fastModel != null && !fastModel.isBlank()
                && !fastModel.equals(model);
        String effectiveModel = useFastModel ? fastModel : model;
        double effectivePriceInput = useFastModel ? fastPriceInputPerMillion : priceInputPerMillion;
        double effectivePriceOutput = useFastModel ? fastPriceOutputPerMillion : priceOutputPerMillion;

        HttpHeaders httpHeaders = new HttpHeaders();
        httpHeaders.add("Authorization", "Bearer " + apiKey);
        httpHeaders.add("Content-Type", "application/json");

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", effectiveModel);
        requestBody.put("messages", new Object[]{
                Map.of("role", "system", "content", AiPrompts.getSystemMessage(withJustification, niveau)),
                Map.of("role", "user", "content", question)
        });
        int maxTokens = AiPrompts.getMaxTokensForLevel(withJustification);
        if (isReasoningModel(effectiveModel)) {
            requestBody.put("max_completion_tokens", Math.max(maxTokens * 4, 2048));
            String effectiveEffort = useFastModel ? fastReasoningEffort : reasoningEffort;
            if (effectiveEffort != null && !effectiveEffort.isBlank()) {
                requestBody.put("reasoning_effort", effectiveEffort.toLowerCase());
            }
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

            double tokenCostUsd = (promptTokens * effectivePriceInput + completionTokens * effectivePriceOutput) / 1_000_000;

            UsageInfo usageInfo = new UsageInfo(
                    totalTokens,
                    baseRequestPrice,
                    promptTokens,
                    completionTokens,
                    tokenCostUsd
            );
            currentUsage.set(UsageInfo.accumulate(currentUsage.get(), usageInfo));

            log.debug("Niveau: {}, Modèle: {}, Tokens: {}, Coût: {}", titre, effectiveModel, totalTokens, tokenCostUsd);

            return assistantMessage;

        } catch (Exception e) {
            if (useFastModel && isModelNotFoundError(e)) {
                fastModelDisabled = true;
                log.warn("Modèle rapide '{}' indisponible (404/déprécié) — désactivation automatique et repli immédiat sur '{}'",
                        fastModel, model);
                return demanderAiAide(titre, question, withJustification, niveau, false);
            }
            log.error("Erreur lors de la requête à l'API OpenAI: {}", e.getMessage());
            throw new AiProviderException("Erreur OpenAI: " + e.getMessage(), e);
        }
    }

    private static boolean isModelNotFoundError(Exception e) {
        if (e instanceof org.springframework.web.client.HttpClientErrorException.NotFound) {
            return true;
        }
        String msg = e.getMessage();
        return msg != null && (msg.contains("model_not_found")
                || msg.contains("deprecated")
                || msg.contains("does not have access to model"));
    }

    /**
     * Les modèles de raisonnement OpenAI (gpt-5*, gpt-6*, o1*, o3*, o4*) exigent
     * max_completion_tokens à la place de max_tokens et refusent temperature=0.
     */
    public static boolean isReasoningModel(String model) {
        if (model == null) {
            return false;
        }
        String normalized = model.trim().toLowerCase();
        return normalized.matches("^gpt-([5-9]|\\d{2,})([.-]|$).*")
                || normalized.startsWith("o1")
                || normalized.startsWith("o3")
                || normalized.startsWith("o4");
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
