package com.muhend.backend.pricing.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * DTO pour créer un nouveau plan tarifaire.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreatePricingPlanRequest {

    @NotBlank(message = "Le nom est obligatoire")
    @Size(max = 100, message = "Le nom ne peut pas dépasser 100 caractères")
    private String name;

    @Size(max = 500, message = "La description ne peut pas dépasser 500 caractères")
    private String description;

    @DecimalMin(value = "0.0", inclusive = true, message = "Le prix mensuel doit être positif ou nul")
    private BigDecimal pricePerMonth;

    @DecimalMin(value = "0.0", inclusive = true, message = "Le prix par requête doit être positif ou nul")
    private BigDecimal pricePerRequest;

    @Min(value = 0, message = "Le quota mensuel doit être positif ou nul")
    private Integer monthlyQuota;

    @Min(value = 0, message = "La période d'essai doit être positive ou nulle")
    private Integer trialPeriodDays;

    private String features;

    private Boolean isActive = true;

    @NotNull(message = "L'ordre d'affichage est obligatoire")
    @Min(value = 0, message = "L'ordre d'affichage doit être positif ou nul")
    private Integer displayOrder;

    @Size(max = 10, message = "La version de marché ne peut pas dépasser 10 caractères")
    private String marketVersion = "DEFAULT";

    @Size(max = 3, message = "La devise ne peut pas dépasser 3 caractères")
    private String currency = "EUR";

    private Boolean isCustom = false;

    private Long organizationId;
}
