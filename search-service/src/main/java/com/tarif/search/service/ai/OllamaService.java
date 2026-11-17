package com.tarif.search.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tarif.search.model.UsageInfo;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Service pour l'intégration avec Ollama (modèles locaux).
 */
@Service
@Slf4j
public class OllamaService implements AiProvider {

    private final AiPrompts aiPrompts;
    private final RestTemplate restTemplate;
    private final String baseUrl;
    private final String model;
    private final int numCtx;
    private final String keepAlive;
    private final boolean jsonMode;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final ThreadLocal<UsageInfo> currentUsage = new ThreadLocal<>();

    public OllamaService(
            AiPrompts aiPrompts,
            RestTemplate restTemplate,
            String baseUrl,
            String model) {
        this(aiPrompts, restTemplate, baseUrl, model, 16384, "24h", true);
    }

    @Autowired
    public OllamaService(
            AiPrompts aiPrompts,
            RestTemplate restTemplate,
            @Value("${ai.ollama.base-url:http://localhost:11434}") String baseUrl,
            @Value("${ai.ollama.model:qwen2.5:14b}") String model,
            @Value("${ai.ollama.num-ctx:16384}") int numCtx,
            @Value("${ai.ollama.keep-alive:24h}") String keepAlive,
            @Value("${ai.ollama.json-mode:true}") boolean jsonMode) {
        this.aiPrompts = aiPrompts;
        this.restTemplate = restTemplate;
        this.baseUrl = baseUrl != null ? baseUrl.replaceAll("/+$", "") : "http://localhost:11434";
        this.model = model;
        this.numCtx = numCtx;
        this.keepAlive = keepAlive;
        this.jsonMode = jsonMode;
        log.info("OllamaService initialisé avec le modèle: {} sur {} (num_ctx={}, keep_alive={}, jsonMode={})",
                model, this.baseUrl, numCtx, keepAlive, jsonMode);
    }

    @Override
    public String demanderAiAide(String titre, String question, boolean withJustification, String niveau) {

        HttpHeaders httpHeaders = new HttpHeaders();
        httpHeaders.add("Content-Type", "application/json");

        String systemMessage = AiPrompts.getSystemMessage(withJustification, niveau);
        int maxTokens = AiPrompts.getMaxTokensForLevel(withJustification);

        Map<String, Object> options = new HashMap<>();
        options.put("temperature", 0.0);
        options.put("num_predict", maxTokens);
        options.put("num_ctx", numCtx);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", model);
        requestBody.put("messages", List.of(
                Map.of("role", "system", "content", systemMessage),
                Map.of("role", "user", "content", question)
        ));
        requestBody.put("stream", false);
        requestBody.put("keep_alive", keepAlive);
        if (jsonMode) {
            requestBody.put("format", "json");
        }
        requestBody.put("options", options);

        String body;
        try {
            body = objectMapper.writeValueAsString(requestBody);
        } catch (Exception e) {
            log.error("Erreur lors de la sérialisation JSON", e);
            throw new AiProviderException("Erreur sérialisation requête Ollama: " + e.getMessage(), e);
        }

        HttpEntity<String> entity = new HttpEntity<>(body, httpHeaders);
        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    baseUrl + "/api/chat",
                    HttpMethod.POST,
                    entity,
                    String.class
            );

            if (!response.getStatusCode().is2xxSuccessful()) {
                log.error("Erreur API Ollama - Status: {}", response.getStatusCode());
                currentUsage.remove();
                throw new AiProviderException("Erreur HTTP Ollama: " + response.getStatusCode(), null);
            }

            String responseBody = response.getBody();
            if (responseBody == null || responseBody.isBlank()) {
                currentUsage.remove();
                throw new AiProviderException("Réponse vide reçue d'Ollama", null);
            }

            JsonNode rootNode = objectMapper.readTree(responseBody);
            String assistantMessage = rootNode.path("message").path("content").asText("");
            if (assistantMessage.isBlank()) {
                assistantMessage = rootNode.path("response").asText("");
            }

            int promptTokens = rootNode.path("prompt_eval_count").asInt(0);
            int completionTokens = rootNode.path("eval_count").asInt(0);

            UsageInfo usageInfo = new UsageInfo(
                    promptTokens + completionTokens,
                    0.0, // Ollama est gratuit (local)
                    promptTokens,
                    completionTokens,
                    0.0
            );
            currentUsage.set(usageInfo);

            return assistantMessage;

        } catch (AiProviderException e) {
            throw e;
        } catch (Exception e) {
            log.error("Erreur lors de la requête à Ollama: {}", e.getMessage());
            currentUsage.remove();
            throw new AiProviderException("Erreur Ollama: " + e.getMessage(), e);
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
