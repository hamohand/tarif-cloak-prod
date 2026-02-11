package com.tarif.search.service.ai.batch.models;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

/**
 * Représente le statut d'un batch.
 */
@Data
@Builder
public class BatchStatus {
    private String id;
    private String processingStatus; // "in_progress" ou "ended"
    private Map<String, Integer> requestCounts;
    private String createdAt;
    private String endedAt;
    private String resultsUrl;
    private String provider; // Provider utilisé (anthropic, openai, etc.)

    /**
     * Vérifie si le batch est terminé.
     */
    public boolean isEnded() {
        return "ended".equals(processingStatus);
    }

    /**
     * Vérifie si le batch est en cours de traitement.
     */
    public boolean isInProgress() {
        return "in_progress".equals(processingStatus);
    }
}
