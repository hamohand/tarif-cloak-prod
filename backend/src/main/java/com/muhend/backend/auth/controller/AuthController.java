package com.muhend.backend.auth.controller;

import com.muhend.backend.auth.dto.UserRegistrationRequest;
import com.muhend.backend.auth.service.PendingRegistrationService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")  // Traefik enlève le préfixe /api avec stripprefix
@Slf4j
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);
    private final PendingRegistrationService pendingRegistrationService;

    public AuthController(PendingRegistrationService pendingRegistrationService) {
        this.pendingRegistrationService = pendingRegistrationService;
        logger.info("AuthController initialized (Box Locale DZ)");
    }

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@Valid @RequestBody UserRegistrationRequest registrationRequest) {
        logger.warn("Tentative d'auto-inscription bloquée sur la Box Locale ({})", registrationRequest.getEmail());
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of(
                        "error", "REGISTRATION_DISABLED",
                        "message", "L'inscription publique est désactivée sur cette Box locale. Contactez l'administrateur de votre organisation."
                ));
    }
    
    @PostMapping("/send-confirmation-otp")
    public ResponseEntity<?> sendConfirmationOtp(@RequestParam String token) {
        logger.info("=== OTP confirmation bypassed for MVP ===");
        // Bypassed: On ne fait plus rien, on retourne un succès bidon pour ne pas casser l'ancien frontend si besoin
        return ResponseEntity.ok(Map.of(
            "message", "OTP bypassé.",
            "maskedEmail", "bypassed@example.com"
        ));
    }

    @GetMapping("/confirm-registration")
    public ResponseEntity<?> confirmRegistration(
            @RequestParam String token, 
            @RequestParam(required = false) String otp) {
        logger.info("=== Registration confirmation request received ===");
        try {
            pendingRegistrationService.confirmRegistration(token, otp);
            logger.info("✓ Registration confirmed successfully: token={}", token);
            return ResponseEntity.ok(Map.of(
                "message", "Inscription confirmée avec succès ! Vous pouvez maintenant vous connecter.",
                "success", true
            ));
        } catch (IllegalArgumentException e) {
            logger.error("✗ Invalid confirmation: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            logger.error("✗ Registration state error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            logger.error("✗ Error confirming registration: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Erreur lors de la confirmation de l'inscription", "details", e.getMessage()));
        }
    }
}