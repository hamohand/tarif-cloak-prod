package com.muhend.backend.internal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * DTO de réponse pour la vérification du quota.
 * Utilisé par le search-service pour savoir si une recherche est autorisée.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuotaCheckResponse {

    /**
     * Indique si la recherche est autorisée.
     */
    private boolean canSearch;

    /**
     * Indique si le quota mensuel est respecté.
     */
    private boolean quotaOk;

    /**
     * Indique si le pay-per-request est disponible en cas de dépassement.
     */
    private boolean canUsePayPerRequest;

    /**
     * ID de l'organisation de l'utilisateur.
     */
    private Long organizationId;

    /**
     * Nombre de requêtes effectuées ce mois.
     */
    private Integer currentUsage;

    /**
     * Quota mensuel autorisé (null = illimité).
     */
    private Integer monthlyQuota;

    /**
     * Prix par requête si pay-per-request actif.
     */
    private BigDecimal payPerRequestPrice;

    /**
     * Devise du prix.
     */
    private String currency;

    /**
     * Message d'erreur ou d'information.
     */
    private String message;
}
