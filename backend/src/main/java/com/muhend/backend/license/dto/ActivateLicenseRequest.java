package com.muhend.backend.license.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ActivateLicenseRequest {

    @NotBlank(message = "La clé de licence est obligatoire")
    private String token;
}
