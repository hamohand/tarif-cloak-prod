package com.muhend.backend.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UserRegistrationRequest {
    @NotBlank(message = "Le nom d'utilisateur est obligatoire")
    private String username;

    @NotBlank(message = "L'email est obligatoire")
    @Email(message = "Format d'email invalide")
    private String email;

    @NotBlank(message = "Le mot de passe est obligatoire")
    @Size(min = 8, message = "Le mot de passe doit contenir au moins 8 caractères")
    private String password;

    private String firstName;

    private String lastName;
    
    // Informations de l'organisation
    @NotBlank(message = "Le nom de l'organisation est obligatoire")
    @Size(min = 1, max = 255, message = "Le nom de l'organisation doit contenir entre 1 et 255 caractères")
    private String organizationName;
    
    @NotBlank(message = "L'email de l'organisation est obligatoire")
    @Email(message = "Format d'email invalide pour l'organisation")
    @Size(max = 255, message = "L'email de l'organisation doit contenir au maximum 255 caractères")
    private String organizationEmail; // Obligatoire et utilisé comme identifiant unique
}
