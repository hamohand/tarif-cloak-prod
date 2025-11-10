package com.muhend.backend.auth.controller;

import com.muhend.backend.auth.dto.UserRegistrationRequest;
import com.muhend.backend.auth.service.KeycloakAdminService;
import com.muhend.backend.organization.dto.CreateOrganizationRequest;
import com.muhend.backend.organization.service.OrganizationService;
import jakarta.validation.Valid;
import jakarta.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")  // Traefik enlève le préfixe /api avec stripprefix
@Slf4j
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);
    private final KeycloakAdminService keycloakAdminService;
    private final OrganizationService organizationService;

    public AuthController(KeycloakAdminService keycloakAdminService, OrganizationService organizationService) {
        this.keycloakAdminService = keycloakAdminService;
        this.organizationService = organizationService;
        logger.info("AuthController initialized");
    }

    @PostMapping("/register")
    @Transactional
    public ResponseEntity<?> registerUser(@Valid @RequestBody UserRegistrationRequest registrationRequest) {
        logger.info("=== Registration request received ===");
        logger.info("Username: {}", registrationRequest.getUsername());
        logger.info("Email: {}", registrationRequest.getEmail());
        logger.info("FirstName: {}", registrationRequest.getFirstName());
        logger.info("LastName: {}", registrationRequest.getLastName());
        logger.info("OrganizationName: {}", registrationRequest.getOrganizationName());
        logger.info("OrganizationEmail: {}", registrationRequest.getOrganizationEmail());

        try {
            // 1. Créer l'utilisateur dans Keycloak
            Response response = keycloakAdminService.createUser(registrationRequest);
            int status = response.getStatus();
            logger.info("Keycloak response status: {}", status);

            if (status == Response.Status.CREATED.getStatusCode()) {
                logger.info("✓ User created successfully in Keycloak: {}", registrationRequest.getUsername());
                
                // 2. Récupérer l'ID Keycloak de l'utilisateur créé depuis l'en-tête Location
                String keycloakUserId = keycloakAdminService.getUserIdFromResponse(response);
                
                // Fallback: si l'extraction depuis la réponse échoue, chercher par username
                if (keycloakUserId == null) {
                    logger.warn("Impossible d'extraire l'ID depuis la réponse, tentative par username...");
                    keycloakUserId = keycloakAdminService.getUserIdByUsername(registrationRequest.getUsername());
                }
                
                if (keycloakUserId == null) {
                    logger.error("✗ Impossible de récupérer l'ID Keycloak de l'utilisateur créé");
                    response.close();
                    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "Utilisateur créé dans Keycloak mais impossible de récupérer son ID"));
                }
                
                logger.info("✓ Keycloak User ID retrieved: {}", keycloakUserId);
                
                // 3. Créer l'organisation
                CreateOrganizationRequest orgRequest = new CreateOrganizationRequest();
                orgRequest.setName(registrationRequest.getOrganizationName());
                orgRequest.setEmail(registrationRequest.getOrganizationEmail());
                
                try {
                    var organizationDto = organizationService.createOrganization(orgRequest);
                    logger.info("✓ Organization created: id={}, name={}", organizationDto.getId(), organizationDto.getName());
                    
                    // 4. Associer l'utilisateur à l'organisation
                    organizationService.addUserToOrganization(organizationDto.getId(), keycloakUserId);
                    logger.info("✓ User {} associated with organization {}", keycloakUserId, organizationDto.getId());
                    
                    response.close();
                    return ResponseEntity.status(HttpStatus.CREATED)
                        .body(Map.of(
                            "message", "Utilisateur et organisation créés avec succès",
                            "organizationId", organizationDto.getId(),
                            "organizationName", organizationDto.getName()
                        ));
                } catch (IllegalArgumentException e) {
                    // Erreur lors de la création de l'organisation (ex: nom déjà existant)
                    logger.error("✗ Error creating organization: {}", e.getMessage());
                    response.close();
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "Erreur lors de la création de l'organisation: " + e.getMessage()));
                }
            } else if (status == Response.Status.CONFLICT.getStatusCode()) {
                logger.warn("⚠ User already exists: {}", registrationRequest.getUsername());
                response.close();
                return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "L'utilisateur existe déjà"));
            } else {
                String errorBody = response.hasEntity() ? response.readEntity(String.class) : "No error body";
                logger.error("✗ Keycloak error (status {}): {}", status, errorBody);
                response.close();
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erreur lors de la création de l'utilisateur: " + errorBody));
            }
        } catch (RuntimeException e) {
            logger.error("✗ Runtime error during user registration: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of(
                    "error", "Erreur de connexion à Keycloak",
                    "details", e.getMessage(),
                    "cause", e.getCause() != null ? e.getCause().getMessage() : "Unknown"
                ));
        }
    }
}