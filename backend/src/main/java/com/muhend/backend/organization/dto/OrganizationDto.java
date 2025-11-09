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
    private Integer monthlyQuota; // null = quota illimité
    private LocalDateTime createdAt;
    
    // Pour les réponses avec le nombre d'utilisateurs
    private Long userCount;
}

