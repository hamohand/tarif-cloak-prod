package com.muhend.backend.pricing.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * DTO pour les plans tarifaires.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PricingPlanDto {
    
    private Long id;
    private String name;
    private String description;
    private BigDecimal pricePerMonth;
    private Integer monthlyQuota; // null = quota illimité
    private String features;
    private Boolean isActive;
    private Integer displayOrder;
}

