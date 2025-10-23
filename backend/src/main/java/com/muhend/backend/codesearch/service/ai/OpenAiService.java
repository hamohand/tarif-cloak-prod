package com.muhend.backend.codesearch.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
public class OpenAiService {
    private final AiPrompts aiPrompts;
    private final String aiKey;

    public OpenAiService(AiPrompts aiPrompts, @Value("${OPENAI_API_KEY}") String aiKey) {
        this.aiPrompts = aiPrompts;
        this.aiKey = aiKey;
    }
    /**
     * Pour utiliser GPT-4o ou toute autre API d'OpenAI, vous devez d'abord intégrer leur SDK ou utiliser un client HTTP pour appeler l'API.
     */
//    @Value("${OPENAI_API_KEY}")
//    private String aiKey;

    private final String aiApiUrl = "https://api.openai.com/v1/chat/completions"; // URL corrigée
    //private static final String OPENAI_API_URL = "http://localhost:11434/completions\n"; // URL

    private final String aiModel = "gpt-4.1";
    //private final String aiModel = "gpt-4.1-mini";
    //   private final String OPENAI_MODEL = "llama3";
    private final int maxTokens = 500;
    private final float temperature = 0.0F;

    double prix_requete = 0.00;

//    /// //////////////// Options pour le prompt et le résultat /////////////////////////////////////
//    // - message système: true avec justification false sans.
//    private final Boolean withJustification = false;
//    // - Afficher toute la cascade des messages (true) ou uniquement le résultat de la position demandée (false)
//    private final Boolean withCascade = false;
//    /// ///////////////////////////////////////////////////////////

    public String demanderAiAide(String titre, String question) {
        log.info("Clé API OpenAI chargée. Longueur2 : {}", aiKey.length());
        log.info("Clé API OpenAI chargée. valeur2 : {}", aiKey);
        //Préparation du client REST
        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders httpHeaders = new HttpHeaders();
        httpHeaders.add("Authorization", "Bearer " + aiKey);
        httpHeaders.add("Content-Type", "application/json");

        // Construction robuste du corps JSON
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", aiModel); // Spécifiez le modèle
        requestBody.put("messages", new Object[]{
                Map.of("role", "system", "content", AiPrompts.getSystemMessage(aiPrompts.defTheme.isWithJustification())), // message système: true avec justification false sans
                Map.of("role", "user", "content", question)
        });
        requestBody.put("max_tokens", maxTokens);  // 150 // Limite du nombre de tokens
        requestBody.put("temperature", temperature); // 0.1 // Ajustement de la créativité

        // Sérialisation en JSON avec ObjectMapper
        ObjectMapper objectMapper = new ObjectMapper();
        String body;
        try {
            body = objectMapper.writeValueAsString(requestBody);
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de la sérialisation JSON.", e);
        }

        // Envoi de la requête POST
        HttpEntity<String> entity = new HttpEntity<>(body, httpHeaders);
        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    aiApiUrl,
                    HttpMethod.POST,
                    entity,
                    String.class
            );

            // Vérifier le code de statut
            if (!response.getStatusCode().is2xxSuccessful()) {
                log.error("Erreur API Openai - Status: {}, Body: {}",
                    response.getStatusCode(), response.getBody());
                return "Erreur lors de l'appel à l'API IA.";
            }

            // Lire le contenu JSON
            String responseBody = response.getBody();
            if (responseBody == null) {
                return "Aucune réponse n'a été trouvée.";
            }

            // Récupérer le message de l'assistant
            // Extraire le champ `choices[0].message.content` de la réponse de l'API
            JsonNode rootNode = objectMapper.readTree(responseBody); //transforme en JSON
            String assistantMessage = rootNode
                    .path("choices")
                    .get(0)
                    .path("message")
                    .path("content")
                    .asText();
            //    System.out.println("AI : Réponse STRING assistantMessage ---- : " + assistantMessage);

            // Récupérer les informations du nombre de tokens utilisés
            int promptTokens = rootNode
                    .path("usage")
                    .path("prompt_tokens")
                    .asInt();
            int completionTokens = rootNode
                    .path("usage")
                    .path("completion_tokens")
                    .asInt();
            int totalTokens = rootNode
                    .path("usage")
                    .path("total_tokens")
                    .asInt();

            // 💰 Tarifs GPT-4o mini (au 1er sept 2025)
            final double PRICE_INPUT = 0.15 / 1_000_000;   // $ par token input
            final double PRICE_OUTPUT = 0.60 / 1_000_000;  // $ par token output
            final double PRICE_TOTAL = PRICE_INPUT + PRICE_OUTPUT;
            //total requete
            prix_requete = totalTokens * PRICE_TOTAL;

            // Enregistrer ou afficher les informations des tokens pour diagnostic
//            log.info("Prompt Tokens (input), niveau : " + titre +" = " + promptTokens);
//            System.out.println("Prompt Tokens (input), niveau : " + titre + " = " + promptTokens);
//            log.info("Completion Tokens (output), niveau "+ titre +" = " + completionTokens);
//            System.out.println("Completion Tokens (output), niveau "+ titre +" = " + completionTokens);
//            log.info("Total Tokens, niveau "+ titre +" = " + totalTokens);
            System.out.println("Niveau "+ titre +"  -Total Tokens = " + totalTokens + " tokens" + "   -Total Prix = " + String.format("%.2f",prix_requete * 100)  +" 'cents de $'");

            /// //////////////////////////////////////////////////////////////

            return assistantMessage;

        } catch (Exception e) {
            // Logs pour un meilleur diagnostic
            System.err.println("Erreur lors de la requête à l'API OpenAI : " + e.getMessage());
            return "L'appel à l'API OpenAI a échoué.";
        }

    }
}
