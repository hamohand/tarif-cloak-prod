package com.tarif.search.service.ai.batch.models;

import lombok.Builder;
import lombok.Data;

/**
 * Représente une requête de recherche pour le batch.
 */
@Data
@Builder
public class SearchRequest {
    private String customId;
    private String searchTerm;
    private String ragContext;
    private String targetLevel; // POSITIONS6 ou POSITIONS10
    private String zone;        // DZ ou EU
    private String provider; // Pour tracking du provider utilisé
}
