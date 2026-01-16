package com.tarif.search.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Classe pour stocker les informations d'utilisation d'une requête IA.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UsageInfo {
    private Integer tokens;
    private Double costUsd;
    private Integer promptTokens;
    private Integer completionTokens;
    private Double tokenCostUsd;
}
