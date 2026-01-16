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

/**
 * Service pour l'intégration avec Ollama (modèles locaux).
 */
@Service
@Slf4j
public class OllamaService implements AiProvider {

    private final AiPrompts aiPrompts;
    private final String baseUrl;
    private final String model;

    private static final ThreadLocal<UsageInfo> currentUsage = new ThreadLocal<>();

    public OllamaService(
            AiPrompts aiPrompts,
            @Value("${ai.ollama.base-url:http://localhost:11434}") String baseUrl,
            @Value("${ai.ollama.model:llama3}") String model) {
        this.aiPrompts = aiPrompts;
        this.baseUrl = baseUrl;
        this.model = model;
        log.info("OllamaService initialisé avec le modèle: {} sur {}", model, baseUrl);
    }

    @Override
    public String demanderAiAide(String titre, String question) {
        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders httpHeaders = new HttpHeaders();
        httpHeaders.add("Content-Type", "application/json");

        String systemMessage = AiPrompts.getSystemMessage(aiPrompts.getDefTheme().isWithJustification());
        String fullPrompt = systemMessage + "\n\nUser: " + question;

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", model);
        requestBody.put("prompt", fullPrompt);
        requestBody.put("stream", false);

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
                    baseUrl + "/api/generate",
                    HttpMethod.POST,
                    entity,
                    String.class
            );

            if (!response.getStatusCode().is2xxSuccessful()) {
                log.error("Erreur API Ollama - Status: {}", response.getStatusCode());
                return "";
            }

            String responseBody = response.getBody();
            if (responseBody == null) {
                return "";
            }

            JsonNode rootNode = objectMapper.readTree(responseBody);
            String assistantMessage = rootNode.path("response").asText();

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

        } catch (Exception e) {
            log.error("Erreur lors de la requête à Ollama: {}", e.getMessage());
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
