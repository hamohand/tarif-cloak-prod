package com.muhend.backend.pricing.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO pour créer une demande de devis.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateQuoteRequestDto {
    
    @NotNull(message = "L'ID de l'organisation est requis")
    private Long organizationId;
    
    @NotBlank(message = "Le nom du contact est requis")
    private String contactName;
    
    @NotBlank(message = "L'email du contact est requis")
    @Email(message = "L'email doit être valide")
    private String contactEmail;
    
    private String message; // Optionnel
}

