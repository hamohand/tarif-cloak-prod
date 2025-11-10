package com.muhend.backend.organization.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO pour créer une organisation.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateOrganizationRequest {
    
    @NotBlank(message = "Le nom de l'organisation est obligatoire")
    @Size(min = 1, max = 255, message = "Le nom doit contenir entre 1 et 255 caractères")
    private String name;
    
    @NotBlank(message = "L'email de l'organisation est obligatoire")
    @Email(message = "Format d'email invalide")
    @Size(max = 255, message = "L'email doit contenir au maximum 255 caractères")
    private String email; // Email de l'organisation (obligatoire et identifiant unique)
    
    private Long pricingPlanId; // ID du plan tarifaire sélectionné (optionnel)
}

