package com.muhend.backend.auth.controller;

import com.muhend.backend.auth.dto.UserRegistrationRequest;
import com.muhend.backend.auth.service.KeycloakAdminService;
import jakarta.validation.Valid;
import jakarta.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@Slf4j
@CrossOrigin(origins = "http://localhost:4200")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);
    private final KeycloakAdminService keycloakAdminService;

    public AuthController(KeycloakAdminService keycloakAdminService) {
        this.keycloakAdminService = keycloakAdminService;
        logger.info("AuthController initialized");
    }

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@Valid @RequestBody UserRegistrationRequest registrationRequest) {
        logger.info("=== Registration request received ===");
        logger.info("Username: {}", registrationRequest.getUsername());
        logger.info("Email: {}", registrationRequest.getEmail());
        logger.info("FirstName: {}", registrationRequest.getFirstName());
        logger.info("LastName: {}", registrationRequest.getLastName());

        try {
            Response response = keycloakAdminService.createUser(registrationRequest);
            int status = response.getStatus();
            logger.info("Keycloak response status: {}", status);

            if (status == Response.Status.CREATED.getStatusCode()) {
                logger.info("✓ User created successfully: {}", registrationRequest.getUsername());
                response.close();
                return ResponseEntity.status(HttpStatus.CREATED)
                    .body(Map.of("message", "Utilisateur créé avec succès"));
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