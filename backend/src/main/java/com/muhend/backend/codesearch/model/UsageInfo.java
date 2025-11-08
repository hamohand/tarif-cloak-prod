package com.muhend.backend.codesearch.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Classe pour stocker les informations d'utilisation d'une requête OpenAI.
 * Utilisée pour transmettre les données de coût et de tokens depuis OpenAiService.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UsageInfo {
    private Integer tokens;
    private Double costUsd;
    private Integer promptTokens;
    private Integer completionTokens;
}

