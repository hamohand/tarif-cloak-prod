package com.muhend.backend.license.controller;

import com.muhend.backend.license.dto.ActivateLicenseRequest;
import com.muhend.backend.license.dto.LicenseStatusDto;
import com.muhend.backend.license.service.LicenseService;
import com.muhend.backend.organization.model.Organization;
import com.muhend.backend.organization.repository.OrganizationRepository;
import com.muhend.backend.organization.service.CollaboratorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/license")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "License On-Premise", description = "Gestion et activation de la licence sur les instances locales (Box IA)")
public class LicenseController {

    private final LicenseService licenseService;
    private final OrganizationRepository organizationRepository;
    private final CollaboratorService collaboratorService;

    @GetMapping("/status")
    @PreAuthorize("isAuthenticated()")
    @Operation(
            summary = "Statut de la licence",
            description = "Retourne l'état courant de la licence On-Premise ou indique le mode SaaS.",
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<LicenseStatusDto> getStatus() {
        return ResponseEntity.ok(licenseService.getCurrentStatus());
    }

    @PostMapping("/activate")
    @PreAuthorize("hasAnyRole('ADMIN', 'ORGANIZATION')")
    @Operation(
            summary = "Activer une licence On-Premise",
            description = "Valide et enregistre un jeton de licence signé Ed25519 (format TCI1).",
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<?> activate(@Valid @RequestBody ActivateLicenseRequest request) {
        try {
            LicenseStatusDto status = licenseService.activateLicense(request.getToken());
            if (status.isValid()) {
                for (Organization org : organizationRepository.findAll()) {
                    try {
                        collaboratorService.reactivateAllCollaborators(org);
                    } catch (Exception e) {
                        log.warn("Erreur réactivation collaborateurs après activation licence pour org {}: {}",
                                org.getId(), e.getMessage());
                    }
                }
            }
            return ResponseEntity.ok(status);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "INVALID_LICENSE", "message", e.getMessage()));
        }
    }
}
