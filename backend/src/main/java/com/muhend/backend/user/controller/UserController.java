package com.muhend.backend.user.controller;

import com.muhend.backend.organization.dto.ChangePricingPlanRequest;
import com.muhend.backend.organization.dto.OrganizationDto;
import com.muhend.backend.organization.exception.UserNotAssociatedException;
import com.muhend.backend.organization.service.OrganizationService;
import com.muhend.backend.organization.service.PlanChangeService;
import com.muhend.backend.organization.service.QuotaService;
import com.muhend.backend.pricing.dto.PricingPlanDto;
import com.muhend.backend.pricing.service.PricingPlanService;
import com.muhend.backend.usage.model.UsageLog;
import com.muhend.backend.usage.repository.UsageLogRepository;
import org.springframework.http.HttpStatus;
import jakarta.validation.Valid;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.time.LocalTime;

/**
 * Contrôleur pour les endpoints utilisateurs (non-admin).
 * Permet aux utilisateurs de voir leur organisation et leurs statistiques.
 */
@RestController
@RequestMapping("/user")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "User", description = "Endpoints utilisateurs pour consulter leur organisation et leurs statistiques")
public class UserController {

    private final OrganizationService organizationService;
    private final QuotaService quotaService;
    private final PlanChangeService planChangeService;
    private final UsageLogRepository usageLogRepository;
    private final PricingPlanService pricingPlanService;

    /**
     * Récupère l'organisation de l'utilisateur connecté.
     * Un utilisateur DOIT toujours être associé à une organisation.
     */
    @GetMapping("/organization")
    @Operation(
        summary = "Récupérer mon organisation",
        description = "Retourne l'organisation de l'utilisateur connecté. " +
                     "Un utilisateur doit toujours être associé à une organisation.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<OrganizationDto> getMyOrganization() {
        String userId = getCurrentUserId();
        if (userId == null) {
            return ResponseEntity.badRequest().build();
        }

        try {
            Long organizationId = organizationService.getOrganizationIdByUserId(userId);
            OrganizationDto organization = organizationService.getOrganizationById(organizationId);
            return ResponseEntity.ok(organization);
        } catch (UserNotAssociatedException e) {
            log.error("Utilisateur {} non associé à une organisation", userId);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    /**
     * Récupère les statistiques d'utilisation de l'utilisateur connecté.
     */
    @GetMapping("/usage/stats")
    @Operation(
        summary = "Récupérer mes statistiques d'utilisation",
        description = "Retourne les statistiques d'utilisation de l'utilisateur connecté : " +
                     "- Nombre total de requêtes " +
                     "- Coût total " +
                     "- Tokens totaux " +
                     "- Utilisations récentes " +
                     "- Statistiques du mois en cours " +
                     "Paramètres optionnels: ?startDate=... et ?endDate=... pour filtrer par période (format: yyyy-MM-dd).",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<Map<String, Object>> getMyUsageStats(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        String userId = getCurrentUserId();
        if (userId == null) {
            return ResponseEntity.badRequest().build();
        }

        try {
            // Récupérer l'organisation de l'utilisateur (obligatoire)
            Long organizationId = organizationService.getOrganizationIdByUserId(userId);
            
            // Déterminer la période (par défaut, ce mois)
            LocalDateTime startDateTime;
            LocalDateTime endDateTime;
            
            if (startDate != null && endDate != null) {
                startDateTime = startDate.atStartOfDay();
                endDateTime = endDate.atTime(LocalTime.MAX);
            } else {
                // Par défaut, ce mois en cours
                LocalDateTime now = LocalDateTime.now();
                startDateTime = now.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
                endDateTime = now.withDayOfMonth(now.toLocalDate().lengthOfMonth())
                        .withHour(23).withMinute(59).withSecond(59).withNano(999999999);
            }

            // Récupérer les logs de l'utilisateur (filtrer par organisation ET utilisateur)
            List<UsageLog> userLogs = usageLogRepository.findByOrganizationIdAndTimestampBetween(organizationId, startDateTime, endDateTime)
                    .stream()
                    .filter(log -> userId.equals(log.getKeycloakUserId()))
                    .toList();

        // Calculer les statistiques
        long totalRequests = userLogs.size();
        BigDecimal totalCost = userLogs.stream()
                .filter(log -> log.getCostUsd() != null)
                .map(UsageLog::getCostUsd)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long totalTokens = userLogs.stream()
                .filter(log -> log.getTokensUsed() != null)
                .mapToLong(UsageLog::getTokensUsed)
                .sum();

        // Utilisations récentes (10 dernières)
        List<Map<String, Object>> recentUsage = userLogs.stream()
                .sorted((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()))
                .limit(10)
                .map(this::toUsageLogMap)
                .toList();

            // Statistiques du mois en cours (pour l'affichage du quota)
            LocalDateTime startOfMonth = LocalDateTime.now().withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
            LocalDateTime endOfMonth = LocalDateTime.now().withDayOfMonth(LocalDateTime.now().toLocalDate().lengthOfMonth())
                    .withHour(23).withMinute(59).withSecond(59).withNano(999999999);
            
            long monthlyCredits = quotaService.computeUserCredits(userId, startOfMonth, endOfMonth);

            Map<String, Object> stats = new LinkedHashMap<>();
            stats.put("totalRequests", totalRequests);
            stats.put("totalCostUsd", totalCost.doubleValue());
            stats.put("totalTokens", totalTokens);
            stats.put("monthlyRequests", monthlyCredits);
            stats.put("recentUsage", recentUsage);
            
            // Ajouter les informations de quota (l'utilisateur a toujours une organisation)
            OrganizationDto organization = organizationService.getOrganizationById(organizationId);
            if (organization != null) {
                // Calculer les crédits consommés par l'organisation ce mois
                long organizationMonthlyUsage = quotaService.computeOrganizationCredits(organizationId, startOfMonth, endOfMonth);
                
                // Récupérer la valeur actuelle du quota depuis le plan tarifaire (pas celle stockée dans l'organisation)
                Integer currentMonthlyQuota = organization.getMonthlyQuota(); // Valeur par défaut (pour compatibilité)
                if (organization.getPricingPlanId() != null) {
                    try {
                        PricingPlanDto plan = pricingPlanService.getPricingPlanById(organization.getPricingPlanId());
                        currentMonthlyQuota = plan.getMonthlyQuota(); // Utiliser la valeur actuelle du plan
                    } catch (Exception e) {
                        log.warn("Impossible de récupérer le plan {} pour l'organisation {}: {}", 
                                organization.getPricingPlanId(), organizationId, e.getMessage());
                        // Utiliser la valeur stockée dans l'organisation en cas d'erreur
                    }
                }
                
                Map<String, Object> quotaInfo = new LinkedHashMap<>();
                quotaInfo.put("monthlyQuota", currentMonthlyQuota);
                quotaInfo.put("currentUsage", organizationMonthlyUsage);
                quotaInfo.put("personalUsage", monthlyCredits);
                quotaInfo.put("remaining", currentMonthlyQuota != null 
                        ? Math.max(0, currentMonthlyQuota - organizationMonthlyUsage)
                        : -1);
                quotaInfo.put("percentageUsed", currentMonthlyQuota != null && currentMonthlyQuota > 0
                        ? (double) organizationMonthlyUsage / currentMonthlyQuota * 100
                        : 0.0);
                stats.put("quotaInfo", quotaInfo);
            }

            return ResponseEntity.ok(stats);
        } catch (UserNotAssociatedException e) {
            log.error("Utilisateur {} non associé à une organisation", userId);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Vous devez être associé à une organisation pour consulter vos statistiques."));
        }
    }

    /**
     * Récupère l'état du quota de l'utilisateur connecté.
     * Un utilisateur DOIT toujours être associé à une organisation.
     */
    @GetMapping("/quota")
    @Operation(
        summary = "Récupérer l'état de mon quota",
        description = "Retourne l'état du quota mensuel de l'organisation de l'utilisateur connecté. " +
                     "Un utilisateur doit toujours être associé à une organisation.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<Map<String, Object>> getMyQuota() {
        String userId = getCurrentUserId();
        if (userId == null) {
            return ResponseEntity.badRequest().build();
        }

        try {
            Long organizationId = organizationService.getOrganizationIdByUserId(userId);
            OrganizationDto organization = organizationService.getOrganizationById(organizationId);
            if (organization == null) {
                return ResponseEntity.notFound().build();
            }

            // Calculer l'utilisation sur la période du cycle du plan (monthlyPlanStartDate → monthlyPlanEndDate)
            // Si le cycle n'est pas initialisé, fallback sur le mois calendaire
            LocalDateTime periodStart;
            LocalDateTime periodEnd;
            if (organization.getMonthlyPlanStartDate() != null && organization.getMonthlyPlanEndDate() != null) {
                periodStart = organization.getMonthlyPlanStartDate().atStartOfDay();
                periodEnd = organization.getMonthlyPlanEndDate().atTime(23, 59, 59);
            } else {
                LocalDate today = LocalDate.now();
                periodStart = today.withDayOfMonth(1).atStartOfDay();
                periodEnd = today.withDayOfMonth(today.lengthOfMonth()).atTime(23, 59, 59);
            }

            // Crédits consommés par l'organisation sur la période (quota partagé)
            long currentUsage = quotaService.computeOrganizationCredits(organizationId, periodStart, periodEnd);

            // Crédits consommés personnellement par l'utilisateur sur la période
            long personalUsage = quotaService.computeUserCredits(userId, periodStart, periodEnd);

            // Récupérer la valeur actuelle du quota depuis le plan tarifaire (pas celle stockée dans l'organisation)
            Integer currentMonthlyQuota = organization.getMonthlyQuota(); // Valeur par défaut (pour compatibilité)
            if (organization.getPricingPlanId() != null) {
                try {
                    PricingPlanDto plan = pricingPlanService.getPricingPlanById(organization.getPricingPlanId());
                    currentMonthlyQuota = plan.getMonthlyQuota(); // Utiliser la valeur actuelle du plan
                } catch (Exception e) {
                    log.warn("Impossible de récupérer le plan {} pour l'organisation {}: {}", 
                            organization.getPricingPlanId(), organizationId, e.getMessage());
                    // Utiliser la valeur stockée dans l'organisation en cas d'erreur
                }
            }

            Map<String, Object> quota = new LinkedHashMap<>();
            quota.put("hasOrganization", true);
            quota.put("organizationId", organizationId);
            quota.put("organizationName", organization.getName());
            quota.put("monthlyQuota", currentMonthlyQuota); // Utiliser la valeur actuelle du plan
            quota.put("currentUsage", currentUsage); // Usage total de l'organisation
            quota.put("personalUsage", personalUsage); // Usage personnel de l'utilisateur
            quota.put("remaining", currentMonthlyQuota != null 
                    ? Math.max(0, currentMonthlyQuota - currentUsage)
                    : -1); // -1 = illimité
            quota.put("percentageUsed", currentMonthlyQuota != null && currentMonthlyQuota > 0
                    ? (double) currentUsage / currentMonthlyQuota * 100
                    : 0.0);
            quota.put("isUnlimited", currentMonthlyQuota == null);

            return ResponseEntity.ok(quota);
        } catch (UserNotAssociatedException e) {
            log.error("Utilisateur {} non associé à une organisation", userId);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Vous devez être associé à une organisation pour consulter votre quota."));
        }
    }
    
    /**
     * Change le plan tarifaire de l'organisation de l'utilisateur connecté.
     */
    @PutMapping("/organization/pricing-plan")
    @Operation(
        summary = "Changer le plan tarifaire de mon organisation",
        description = "Change le plan tarifaire de l'organisation de l'utilisateur connecté. " +
                     "Le quota mensuel sera mis à jour selon le plan sélectionné.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<OrganizationDto> changeMyOrganizationPricingPlan(
            @Valid @RequestBody ChangePricingPlanRequest request) {
        String userId = getCurrentUserId();
        if (userId == null) {
            return ResponseEntity.badRequest().build();
        }

        try {
            Long organizationId = organizationService.getOrganizationIdByUserId(userId);
            OrganizationDto organization = planChangeService.changePricingPlan(organizationId, request.getPricingPlanId());
            return ResponseEntity.ok(organization);
        } catch (UserNotAssociatedException e) {
            log.error("Utilisateur {} non associé à une organisation", userId);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(null);
        }
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
     * Convertit un UsageLog en Map pour la réponse JSON.
     */
    private Map<String, Object> toUsageLogMap(UsageLog log) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", log.getId());
        map.put("endpoint", log.getEndpoint());
        map.put("searchTerm", log.getSearchTerm());
        map.put("tokensUsed", log.getTokensUsed());
        map.put("costUsd", log.getCostUsd() != null ? log.getCostUsd().doubleValue() : null);
        map.put("timestamp", log.getTimestamp().toString());
        return map;
    }
}

