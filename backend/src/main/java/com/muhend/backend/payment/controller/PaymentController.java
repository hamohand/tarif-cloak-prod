package com.muhend.backend.payment.controller;

import com.muhend.backend.organization.dto.OrganizationDto;
import com.muhend.backend.organization.service.OrganizationService;
import com.muhend.backend.payment.dto.CheckoutSessionResponse;
import com.muhend.backend.payment.dto.CreateCheckoutSessionRequest;
import com.muhend.backend.payment.dto.PayInvoiceRequest;
import com.muhend.backend.payment.dto.PaymentDto;
import com.muhend.backend.payment.service.ChargilyService;
import com.muhend.backend.payment.service.PaymentService;
import com.muhend.backend.payment.service.StripeService;
import com.muhend.backend.pricing.dto.PricingPlanDto;
import com.muhend.backend.pricing.service.PricingPlanService;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/**
 * Controller pour gérer les paiements avec routage dynamique Chargily (DZD) / Stripe (EUR).
 */
@RestController
@RequestMapping("/payments")
@Slf4j
@Tag(name = "Payments", description = "Gestion des paiements")
public class PaymentController {
    
    private final StripeService stripeService;
    private final ChargilyService chargilyService;
    private final PaymentService paymentService;
    private final OrganizationService organizationService;
    private final PricingPlanService pricingPlanService;
    
    @Value("${payment.provider:stripe}")
    private String paymentProvider = "stripe";

    @Autowired
    public PaymentController(
            StripeService stripeService,
            ChargilyService chargilyService,
            PaymentService paymentService,
            OrganizationService organizationService,
            PricingPlanService pricingPlanService) {
        this.stripeService = stripeService;
        this.chargilyService = chargilyService;
        this.paymentService = paymentService;
        this.organizationService = organizationService;
        this.pricingPlanService = pricingPlanService;
    }

    /**
     * Détermine la passerelle à utiliser selon la devise/marché du plan ou de l'organisation.
     */
    public String resolvePaymentProvider(Long organizationId, Long pricingPlanId, Long invoiceId) {
        if (pricingPlanId != null) {
            PricingPlanDto plan = pricingPlanService.getPricingPlanById(pricingPlanId);
            if ("DZD".equalsIgnoreCase(plan.getCurrency()) || "DZ".equalsIgnoreCase(plan.getMarketVersion())) {
                return "chargily";
            }
            if ("EUR".equalsIgnoreCase(plan.getCurrency()) || "DEFAULT".equalsIgnoreCase(plan.getMarketVersion())) {
                return "stripe";
            }
        }
        if (organizationId != null) {
            OrganizationDto org = organizationService.getOrganizationById(organizationId);
            if (org != null) {
                if ("DZ".equalsIgnoreCase(org.getMarketVersion()) || "DZ".equalsIgnoreCase(org.getCountry())) {
                    return "chargily";
                }
                if (org.getMarketVersion() != null && !org.getMarketVersion().isBlank()) {
                    return "stripe";
                }
            }
        }
        return paymentProvider != null ? paymentProvider : "stripe";
    }
    
    /**
     * Récupère l'ID de l'utilisateur Keycloak depuis le contexte de sécurité.
     */
    private String getCurrentUserId() {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.getPrincipal() instanceof Jwt) {
                Jwt jwt = (Jwt) authentication.getPrincipal();
                return jwt.getClaimAsString("sub");
            }
        } catch (Exception e) {
            log.error("Erreur lors de la récupération de l'ID utilisateur", e);
        }
        return null;
    }
    
    /**
     * Crée une session de checkout pour un plan tarifaire (Stripe ou Chargily selon le provider actif).
     */
    @PostMapping("/checkout")
    @PreAuthorize("isAuthenticated()")
    @Operation(
            summary = "Créer une session de checkout",
            description = "Crée une session de checkout pour souscrire à un plan tarifaire (Stripe ou Chargily selon la configuration).",
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<CheckoutSessionResponse> createCheckoutSession(
            @Valid @RequestBody CreateCheckoutSessionRequest request) {
        try {
            String userId = getCurrentUserId();
            if (userId == null) {
                return ResponseEntity.badRequest().build();
            }

            Long organizationId = organizationService.getOrganizationIdByUserId(userId);
            if (organizationId == null) {
                return ResponseEntity.badRequest().build();
            }

            String resolvedProvider = resolvePaymentProvider(organizationId, request.getPricingPlanId(), request.getInvoiceId());
            log.info("Routage checkout: organizationId={}, planId={}, provider={}", organizationId, request.getPricingPlanId(), resolvedProvider);

            CheckoutSessionResponse response = "chargily".equals(resolvedProvider)
                    ? chargilyService.createCheckoutSession(organizationId, request)
                    : stripeService.createCheckoutSession(organizationId, request);
            return ResponseEntity.ok(response);

        } catch (StripeException e) {
            log.error("Erreur Stripe lors de la création du checkout", e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Erreur lors de l'initialisation du paiement Stripe", e);
        } catch (IllegalArgumentException e) {
            log.error("Erreur de validation lors de la création du checkout: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage(), e);
        } catch (IllegalStateException e) {
            log.error("Provider de paiement non configuré: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage(), e);
        }
    }
    
    /**
     * Récupère tous les paiements de l'organisation de l'utilisateur connecté.
     */
    @GetMapping("/my-payments")
    @PreAuthorize("isAuthenticated()")
    @Operation(
            summary = "Récupérer mes paiements",
            description = "Retourne tous les paiements de l'organisation de l'utilisateur connecté.",
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<List<PaymentDto>> getMyPayments() {
        String userId = getCurrentUserId();
        if (userId == null) {
            return ResponseEntity.badRequest().build();
        }
        
        Long organizationId = organizationService.getOrganizationIdByUserId(userId);
        if (organizationId == null) {
            return ResponseEntity.ok(List.of());
        }
        
        List<PaymentDto> payments = paymentService.getPaymentsByOrganization(organizationId);
        return ResponseEntity.ok(payments);
    }
    
    /**
     * Récupère un paiement par son ID (pour l'utilisateur connecté).
     */
    @GetMapping("/my-payments/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(
            summary = "Récupérer un de mes paiements",
            description = "Retourne un paiement spécifique de l'organisation de l'utilisateur connecté.",
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<PaymentDto> getMyPayment(@PathVariable Long id) {
        String userId = getCurrentUserId();
        if (userId == null) {
            return ResponseEntity.badRequest().build();
        }
        
        Long organizationId = organizationService.getOrganizationIdByUserId(userId);
        if (organizationId == null) {
            return ResponseEntity.notFound().build();
        }
        
        PaymentDto payment = paymentService.getPaymentById(id);
        
        // Vérifier que le paiement appartient à l'organisation de l'utilisateur
        if (!payment.getOrganizationId().equals(organizationId)) {
            return ResponseEntity.status(403).build();
        }
        
        return ResponseEntity.ok(payment);
    }
    
    /**
     * Récupère le statut d'une session de checkout Stripe (non disponible pour Chargily).
     */
    @GetMapping("/checkout-session/{sessionId}")
    @PreAuthorize("isAuthenticated()")
    @Operation(
            summary = "Récupérer le statut d'une session de checkout",
            description = "Récupère les informations d'une session de checkout Stripe (non disponible pour Chargily).",
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<Map<String, Object>> getCheckoutSessionStatus(@PathVariable String sessionId) {
        if (sessionId == null || !sessionId.startsWith("cs_")) {
            return ResponseEntity.status(503).body(Map.of("error", "Session non gérée par Stripe (paiement Chargily ou identifiant invalide)"));
        }
        try {
            Session session = stripeService.getCheckoutSession(sessionId);

            Map<String, Object> response = Map.of(
                    "id", session.getId(),
                    "status", session.getStatus(),
                    "paymentStatus", session.getPaymentStatus(),
                    "customerId", session.getCustomer() != null ? session.getCustomer() : "",
                    "subscriptionId", session.getSubscription() != null ? session.getSubscription() : ""
            );

            return ResponseEntity.ok(response);

        } catch (StripeException e) {
            log.error("Erreur lors de la récupération de la session de checkout", e);
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Crée une session de checkout pour payer une facture.
     */
    @PostMapping("/invoices/{invoiceId}/checkout")
    @PreAuthorize("isAuthenticated()")
    @Operation(
            summary = "Payer une facture",
            description = "Crée une session de checkout Stripe pour payer une facture spécifique.",
            security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<CheckoutSessionResponse> payInvoice(
            @PathVariable Long invoiceId,
            @Valid @RequestBody(required = false) PayInvoiceRequest request) {
        try {
            String userId = getCurrentUserId();
            if (userId == null) {
                return ResponseEntity.badRequest().build();
            }
            
            Long organizationId = organizationService.getOrganizationIdByUserId(userId);
            if (organizationId == null) {
                return ResponseEntity.badRequest().build();
            }
            
            String successUrl = request != null && request.getSuccessUrl() != null ? 
                    request.getSuccessUrl() : null;
            String cancelUrl = request != null && request.getCancelUrl() != null ? 
                    request.getCancelUrl() : null;
            
            String resolvedProvider = resolvePaymentProvider(organizationId, null, invoiceId);
            CheckoutSessionResponse response = "chargily".equals(resolvedProvider)
                    ? chargilyService.createInvoiceCheckoutSession(organizationId, invoiceId, successUrl, cancelUrl)
                    : stripeService.createInvoiceCheckoutSession(organizationId, invoiceId, successUrl, cancelUrl);
            return ResponseEntity.ok(response);

        } catch (StripeException e) {
            log.error("Erreur Stripe lors du paiement de la facture", e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Erreur lors de l'initialisation du paiement Stripe", e);
        } catch (IllegalArgumentException e) {
            log.error("Erreur de validation lors du paiement de la facture: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage(), e);
        } catch (IllegalStateException e) {
            log.error("Erreur d'état ou provider non configuré pour la facture: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage(), e);
        }
    }
}

