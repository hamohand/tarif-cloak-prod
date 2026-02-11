package com.tarif.search.service.ai.batch.models;

import lombok.Builder;
import lombok.Data;

/**
 * Représente le résultat d'une requête individuelle dans un batch.
 */
@Data
@Builder
public class BatchResult {
    private String customId;
    private String resultType; // "succeeded", "errored", "canceled", "expired"
    private String content;
    private Integer inputTokens;
    private Integer outputTokens;
    private String errorType;
    private String errorMessage;
    private String provider; // Provider utilisé (anthropic, openai, etc.)

    /**
     * Vérifie si la requête a réussi.
     */
    public boolean isSuccess() {
        return "succeeded".equals(resultType);
    }
}
