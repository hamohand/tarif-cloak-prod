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

    /**
     * Cumule les métriques d'utilisation sur plusieurs niveaux de cascade IA
     * sans multiplier le coût fixe de base (baseRequestPrice).
     */
    public static UsageInfo accumulate(UsageInfo previous, UsageInfo current) {
        if (previous == null) {
            return current;
        }
        if (current == null) {
            return previous;
        }
        int totalTokens = (previous.tokens != null ? previous.tokens : 0)
                + (current.tokens != null ? current.tokens : 0);
        int totalPrompt = (previous.promptTokens != null ? previous.promptTokens : 0)
                + (current.promptTokens != null ? current.promptTokens : 0);
        int totalCompletion = (previous.completionTokens != null ? previous.completionTokens : 0)
                + (current.completionTokens != null ? current.completionTokens : 0);
        double totalTokenCost = (previous.tokenCostUsd != null ? previous.tokenCostUsd : 0.0)
                + (current.tokenCostUsd != null ? current.tokenCostUsd : 0.0);
        Double baseCost = previous.costUsd != null ? previous.costUsd : current.costUsd;

        return new UsageInfo(totalTokens, baseCost, totalPrompt, totalCompletion, totalTokenCost);
    }
}
