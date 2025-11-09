package com.muhend.backend.organization.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO pour les opérations sur les organisations.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrganizationDto {
    
    private Long id;
    private String name;
    private String email; // Email de contact de l'organisation
    private Integer monthlyQuota; // null = quota illimité
    private LocalDateTime createdAt;
    
    // Pour les réponses avec le nombre d'utilisateurs
    private Long userCount;
    
    // Pour les réponses avec l'utilisation du quota
    private Long currentMonthUsage; // Nombre de requêtes utilisées ce mois
}

