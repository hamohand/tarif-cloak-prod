package com.muhend.backend.organization.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO pour mettre à jour une organisation.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateOrganizationRequest {
    
    @Size(min = 1, max = 255, message = "Le nom doit contenir entre 1 et 255 caractères")
    private String name;
    
    @Email(message = "Format d'email invalide")
    @Size(max = 255, message = "L'email doit contenir au maximum 255 caractères")
    private String email; // Email de contact (optionnel)
}

