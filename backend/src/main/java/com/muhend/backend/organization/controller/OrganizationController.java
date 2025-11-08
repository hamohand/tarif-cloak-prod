package com.muhend.backend.organization.controller;

import com.muhend.backend.organization.dto.AddUserToOrganizationRequest;
import com.muhend.backend.organization.dto.CreateOrganizationRequest;
import com.muhend.backend.organization.dto.OrganizationDto;
import com.muhend.backend.organization.dto.OrganizationUserDto;
import com.muhend.backend.organization.service.OrganizationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Contrôleur pour gérer les organisations.
 * Phase 2 MVP : Association Utilisateur → Entreprise
 * Tous les endpoints nécessitent le rôle ADMIN.
 */
@RestController
@RequestMapping("/admin/organizations")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Organizations", description = "Gestion des organisations (nécessite le rôle ADMIN)")
public class OrganizationController {
    
    private final OrganizationService organizationService;
    
    @PostMapping
    @Operation(
        summary = "Créer une organisation",
        description = "Crée une nouvelle organisation. Nécessite le rôle ADMIN.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<OrganizationDto> createOrganization(@Valid @RequestBody CreateOrganizationRequest request) {
        OrganizationDto organization = organizationService.createOrganization(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(organization);
    }
    
    @GetMapping
    @Operation(
        summary = "Lister toutes les organisations",
        description = "Retourne la liste de toutes les organisations avec le nombre d'utilisateurs. Nécessite le rôle ADMIN.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<List<OrganizationDto>> getAllOrganizations() {
        List<OrganizationDto> organizations = organizationService.getAllOrganizations();
        return ResponseEntity.ok(organizations);
    }
    
    @GetMapping("/{id}")
    @Operation(
        summary = "Récupérer une organisation",
        description = "Retourne les détails d'une organisation. Nécessite le rôle ADMIN.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<OrganizationDto> getOrganization(@PathVariable Long id) {
        OrganizationDto organization = organizationService.getOrganizationById(id);
        return ResponseEntity.ok(organization);
    }
    
    @PostMapping("/{id}/users")
    @Operation(
        summary = "Ajouter un utilisateur à une organisation",
        description = "Associe un utilisateur Keycloak à une organisation. Nécessite le rôle ADMIN.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<OrganizationUserDto> addUserToOrganization(
            @PathVariable Long id,
            @Valid @RequestBody AddUserToOrganizationRequest request) {
        OrganizationUserDto organizationUser = organizationService.addUserToOrganization(id, request.getKeycloakUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(organizationUser);
    }
    
    @DeleteMapping("/{id}/users/{keycloakUserId}")
    @Operation(
        summary = "Retirer un utilisateur d'une organisation",
        description = "Retire un utilisateur d'une organisation. Nécessite le rôle ADMIN.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<Map<String, String>> removeUserFromOrganization(
            @PathVariable Long id,
            @PathVariable String keycloakUserId) {
        organizationService.removeUserFromOrganization(id, keycloakUserId);
        return ResponseEntity.ok(Map.of(
            "message", "Utilisateur retiré de l'organisation avec succès",
            "organizationId", id.toString(),
            "keycloakUserId", keycloakUserId
        ));
    }
    
    @GetMapping("/{id}/users")
    @Operation(
        summary = "Lister les utilisateurs d'une organisation",
        description = "Retourne la liste de tous les utilisateurs d'une organisation. Nécessite le rôle ADMIN.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<List<OrganizationUserDto>> getUsersByOrganization(@PathVariable Long id) {
        List<OrganizationUserDto> users = organizationService.getUsersByOrganization(id);
        return ResponseEntity.ok(users);
    }
    
    @GetMapping("/user/{keycloakUserId}")
    @Operation(
        summary = "Lister les organisations d'un utilisateur",
        description = "Retourne la liste de toutes les organisations d'un utilisateur. Nécessite le rôle ADMIN.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<List<OrganizationDto>> getOrganizationsByUser(@PathVariable String keycloakUserId) {
        List<OrganizationDto> organizations = organizationService.getOrganizationsByUser(keycloakUserId);
        return ResponseEntity.ok(organizations);
    }
}

