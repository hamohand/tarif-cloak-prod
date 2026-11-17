package com.muhend.backend.pricing.controller;

import com.muhend.backend.codesearch.service.GuestDecodeQuotaService;
import com.muhend.backend.email.service.EmailService;
import com.muhend.backend.organization.dto.OrganizationDto;
import com.muhend.backend.organization.service.OrganizationService;
import com.muhend.backend.pricing.dto.CreateQuoteRequestDto;
import com.muhend.backend.pricing.dto.QuoteRequestDto;
import com.muhend.backend.pricing.dto.UpdateQuoteRequestDto;
import com.muhend.backend.pricing.model.QuoteRequest;
import com.muhend.backend.pricing.service.QuoteRequestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
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

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Controller pour gérer les demandes de devis.
 */
@RestController
@RequestMapping("/quote-requests")
@Slf4j
@Tag(name = "Quote Requests", description = "Endpoints pour gérer les demandes de devis personnalisés")
public class QuoteRequestController {

    private final QuoteRequestService quoteRequestService;
    private final OrganizationService organizationService;
    private final EmailService emailService;
    private final String adminEmail;
    private final int maxPublicQuotesPerIpPerDay;
    private final Map<String, AtomicInteger> publicIpCounters = new ConcurrentHashMap<>();

    @Autowired
    public QuoteRequestController(
            QuoteRequestService quoteRequestService,
            OrganizationService organizationService,
            EmailService emailService,
            @Value("${EMAIL_ADMIN_HSCODE:}") String adminEmail,
            @Value("${quote.public.max-per-ip-per-day:10}") int maxPublicQuotesPerIpPerDay) {
        this.quoteRequestService = quoteRequestService;
        this.organizationService = organizationService;
        this.emailService = emailService;
        this.adminEmail = adminEmail != null ? adminEmail.trim() : "";
        this.maxPublicQuotesPerIpPerDay = Math.max(1, maxPublicQuotesPerIpPerDay);
    }

    @PostMapping
    @Operation(
        summary = "Créer une demande de devis",
        description = "Permet à un prospect sans compte ou à une organisation connectée de demander un devis personnalisé."
    )
    public ResponseEntity<?> createQuoteRequest(
            @Valid @RequestBody CreateQuoteRequestDto dto,
            HttpServletRequest request) {
        String organizationUserId = getCurrentUserId();

        try {
            Long resolvedOrgId = null;
            if (organizationUserId != null) {
                try {
                    Long orgId = organizationService.getOrganizationIdByUserId(organizationUserId);
                    if (orgId != null) {
                        OrganizationDto organization = organizationService.getOrganizationById(orgId);
                        resolvedOrgId = organization != null ? organization.getId() : orgId;
                    }
                } catch (Exception e) {
                    log.warn("Utilisateur {} sans organisation associée pour la demande de devis : {}",
                            organizationUserId, e.getMessage());
                }
            } else {
                String clientIp = GuestDecodeQuotaService.extractClientIp(request);
                if (!allowPublicQuote(clientIp)) {
                    log.warn("Limite quotidienne de demandes de devis publiques atteinte pour l'IP {}", clientIp);
                    return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                            .body(Map.of(
                                    "error", "TOO_MANY_REQUESTS",
                                    "message", "Trop de demandes envoyées aujourd'hui depuis cette connexion. Veuillez réessayer demain ou nous contacter par email."
                            ));
                }
            }

            CreateQuoteRequestDto dtoToSave = new CreateQuoteRequestDto();
            dtoToSave.setOrganizationId(resolvedOrgId);
            dtoToSave.setContactName(dto.getContactName());
            dtoToSave.setContactEmail(dto.getContactEmail());
            dtoToSave.setMessage(dto.getMessage());

            QuoteRequestDto created = quoteRequestService.createQuoteRequest(dtoToSave);
            if (emailService != null) {
                emailService.sendNewQuoteRequestNotificationEmail(
                        adminEmail,
                        created.getContactName(),
                        created.getContactEmail(),
                        created.getOrganizationId(),
                        created.getMessage()
                );
            }
            return ResponseEntity.ok(created);
        } catch (Exception e) {
            log.error("Erreur lors de la création de la demande de devis: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "INTERNAL_ERROR", "message", "Erreur lors de la création de la demande de devis"));
        }
    }

    private boolean allowPublicQuote(String clientIp) {
        String day = LocalDate.now(ZoneOffset.UTC).toString();
        String dayPrefix = day + ":";
        if (publicIpCounters.size() > 1000) {
            publicIpCounters.keySet().removeIf(k -> !k.startsWith(dayPrefix));
        }
        String safeIp = (clientIp == null || clientIp.isBlank()) ? "unknown" : clientIp.trim();
        int count = publicIpCounters.computeIfAbsent(dayPrefix + safeIp, k -> new AtomicInteger(0)).incrementAndGet();
        return count <= maxPublicQuotesPerIpPerDay;
    }
    
    @GetMapping("/organization/{organizationId}")
    @PreAuthorize("isAuthenticated()")
    @Operation(
        summary = "Récupérer les demandes de devis d'une organisation",
        description = "Retourne toutes les demandes de devis d'une organisation spécifique. L'utilisateur doit être membre de cette organisation.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<?> getQuoteRequestsByOrganization(@PathVariable Long organizationId) {
        String organizationUserId = getCurrentUserId();
        if (organizationUserId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "AUTH_REQUIRED", "message", "Authentification requise"));
        }
        
        try {
            // Vérifier que l'utilisateur appartient à cette organisation
            Long resolvedOrgId = organizationService.getOrganizationIdByUserId(organizationUserId);
            if (!resolvedOrgId.equals(organizationId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "FORBIDDEN", "message", "Vous n'avez pas accès à cette organisation"));
            }
            
            List<QuoteRequestDto> requests = quoteRequestService.getQuoteRequestsByOrganization(organizationId);
            return ResponseEntity.ok(requests);
        } catch (Exception e) {
            log.error("Erreur lors de la récupération des demandes de devis: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "INTERNAL_ERROR", "message", "Erreur lors de la récupération des demandes de devis"));
        }
    }
    
    @GetMapping("/my-organization")
    @PreAuthorize("isAuthenticated()")
    @Operation(
        summary = "Récupérer mes demandes de devis",
        description = "Retourne toutes les demandes de devis de l'organisation de l'utilisateur connecté.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<?> getMyOrganizationQuoteRequests() {
        String organizationUserId = getCurrentUserId();
        if (organizationUserId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "AUTH_REQUIRED", "message", "Authentification requise"));
        }
        
        try {
            Long resolvedOrgId = organizationService.getOrganizationIdByUserId(organizationUserId);
            OrganizationDto organization = organizationService.getOrganizationById(resolvedOrgId);
            List<QuoteRequestDto> requests = quoteRequestService.getQuoteRequestsByOrganization(organization.getId());
            return ResponseEntity.ok(requests);
        } catch (Exception e) {
            log.error("Erreur lors de la récupération des demandes de devis: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "INTERNAL_ERROR", "message", "Erreur lors de la récupération des demandes de devis"));
        }
    }
    
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
        summary = "Récupérer toutes les demandes de devis",
        description = "Retourne toutes les demandes de devis. Réservé aux administrateurs.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<List<QuoteRequestDto>> getAllQuoteRequests() {
        List<QuoteRequestDto> requests = quoteRequestService.getAllQuoteRequests();
        return ResponseEntity.ok(requests);
    }
    
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
        summary = "Récupérer une demande de devis par ID",
        description = "Retourne une demande de devis spécifique. Réservé aux administrateurs.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<?> getQuoteRequestById(@PathVariable Long id) {
        try {
            QuoteRequestDto request = quoteRequestService.getQuoteRequestById(id);
            return ResponseEntity.ok(request);
        } catch (IllegalArgumentException e) {
            log.error("Demande de devis non trouvée: {}", id);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "NOT_FOUND", "message", e.getMessage()));
        }
    }
    
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
        summary = "Mettre à jour une demande de devis",
        description = "Met à jour le statut et/ou les notes d'une demande de devis. Réservé aux administrateurs.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<?> updateQuoteRequest(@PathVariable Long id, @Valid @RequestBody UpdateQuoteRequestDto dto) {
        try {
            QuoteRequestDto updated = quoteRequestService.updateQuoteRequest(id, dto);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            log.error("Erreur lors de la mise à jour de la demande de devis: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "NOT_FOUND", "message", e.getMessage()));
        } catch (Exception e) {
            log.error("Erreur lors de la mise à jour de la demande de devis: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "INTERNAL_ERROR", "message", "Erreur lors de la mise à jour de la demande de devis"));
        }
    }
    
    @GetMapping("/status/{status}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
        summary = "Récupérer les demandes de devis par statut",
        description = "Retourne les demandes de devis filtrées par statut. Réservé aux administrateurs.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<List<QuoteRequestDto>> getQuoteRequestsByStatus(@PathVariable String status) {
        try {
            QuoteRequest.QuoteStatus quoteStatus = QuoteRequest.QuoteStatus.valueOf(status.toUpperCase());
            List<QuoteRequestDto> requests = quoteRequestService.getQuoteRequestsByStatus(quoteStatus);
            return ResponseEntity.ok(requests);
        } catch (IllegalArgumentException e) {
            log.error("Statut invalide: {}", status);
            return ResponseEntity.badRequest().build();
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

