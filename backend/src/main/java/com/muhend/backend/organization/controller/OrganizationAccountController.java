package com.muhend.backend.organization.controller;

import com.muhend.backend.auth.model.PendingRegistration;
import com.muhend.backend.auth.service.PendingRegistrationService;
import com.muhend.backend.organization.dto.CreateCollaboratorRequest;
import com.muhend.backend.organization.dto.OrganizationDto;
import com.muhend.backend.organization.dto.OrganizationUserDto;
import com.muhend.backend.organization.service.OrganizationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/organization/account")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Organization Account", description = "Endpoints pour les comptes organisations (gestion des collaborateurs)")
public class OrganizationAccountController {

    private final PendingRegistrationService pendingRegistrationService;
    private final OrganizationService organizationService;

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    @Operation(
            summary = "Mon organisation",
            description = "Retourne les informations de l'organisation liée au compte connecté.",
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<?> getMyOrganization() {
        String organizationUserId = getCurrentUserId();
        if (organizationUserId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "AUTH_REQUIRED", "message", "Authentification requise"));
        }
        try {
            OrganizationDto organization = organizationService.getOrganizationByKeycloakUserId(organizationUserId);
            return ResponseEntity.ok(organization);
        } catch (IllegalArgumentException e) {
            log.warn("Organisation introuvable pour l'utilisateur {}", organizationUserId);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "ORGANIZATION_NOT_FOUND", "message", e.getMessage()));
        }
    }

    @GetMapping("/collaborators")
    @PreAuthorize("isAuthenticated()")
    @Operation(
            summary = "Lister les collaborateurs",
            description = "Retourne la liste des collaborateurs de l'organisation liée au compte connecté.",
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<?> getMyCollaborators() {
        String organizationUserId = getCurrentUserId();
        if (organizationUserId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "AUTH_REQUIRED", "message", "Authentification requise"));
        }
        try {
            OrganizationDto organization = organizationService.getOrganizationByKeycloakUserId(organizationUserId);
            java.util.List<OrganizationUserDto> collaborators =
                    organizationService.getOrganizationUsersByKeycloakUserId(organizationUserId);
            return ResponseEntity.ok(Map.of(
                    "organization", organization,
                    "collaborators", collaborators
            ));
        } catch (IllegalArgumentException e) {
            log.warn("Impossible de lister les collaborateurs pour {}: {}", organizationUserId, e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "ORGANIZATION_NOT_FOUND", "message", e.getMessage()));
        }
    }

    @PostMapping("/collaborators")
    @PreAuthorize("isAuthenticated()")
    @Operation(
            summary = "Inviter un collaborateur",
            description = "Crée une invitation pour un collaborateur. Un email de confirmation est envoyé au collaborateur pour valider son compte.",
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<Map<String, Object>> inviteCollaborator(
            @Valid @RequestBody CreateCollaboratorRequest request) {
        String organizationUserId = getCurrentUserId();
        if (organizationUserId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "AUTH_REQUIRED", "message", "Authentification requise"));
        }
        try {
            PendingRegistration pendingRegistration = pendingRegistrationService.inviteCollaborator(organizationUserId, request);
            return ResponseEntity.ok(Map.of(
                    "message", "Invitation envoyée. Le collaborateur doit confirmer son compte via l'email reçu.",
                    "tokenExpiresAt", pendingRegistration.getExpiresAt()
            ));
        } catch (IllegalArgumentException e) {
            log.warn("Erreur validation invitation collaborateur: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", "INVITATION_INVALID", "message", e.getMessage()));
        } catch (RuntimeException e) {
            log.error("Erreur lors de l'invitation d'un collaborateur: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "INVITATION_ERROR", "message", e.getMessage()));
        }
    }

    private String getCurrentUserId() {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
                return jwt.getClaimAsString("sub");
            }
        } catch (Exception e) {
            log.error("Erreur lors de la récupération de l'ID utilisateur courant", e);
        }
        return null;
    }
}

