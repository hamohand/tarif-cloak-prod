package com.muhend.backend.user.controller;

import com.muhend.backend.organization.dto.ChangePricingPlanRequest;
import com.muhend.backend.organization.dto.OrganizationDto;
import com.muhend.backend.organization.service.OrganizationService;
import com.muhend.backend.usage.model.UsageLog;
import com.muhend.backend.usage.repository.UsageLogRepository;
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
import java.time.LocalTime;
import java.util.*;

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
    private final UsageLogRepository usageLogRepository;

    /**
     * Récupère l'organisation de l'utilisateur connecté.
     */
    @GetMapping("/organization")
    @Operation(
        summary = "Récupérer mon organisation",
        description = "Retourne l'organisation de l'utilisateur connecté. " +
                     "Si l'utilisateur n'a pas d'organisation, retourne null.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<OrganizationDto> getMyOrganization() {
        String userId = getCurrentUserId();
        if (userId == null) {
            return ResponseEntity.badRequest().build();
        }

        Long organizationId = organizationService.getOrganizationIdByUserId(userId);
        if (organizationId == null) {
            return ResponseEntity.ok(null);
        }

        OrganizationDto organization = organizationService.getOrganizationById(organizationId);
        return ResponseEntity.ok(organization);
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

        // Récupérer l'organisation de l'utilisateur
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

        // Récupérer les logs de l'utilisateur
        List<UsageLog> userLogs;
        if (organizationId != null) {
            // Filtrer par organisation ET utilisateur
            userLogs = usageLogRepository.findByOrganizationIdAndTimestampBetween(organizationId, startDateTime, endDateTime)
                    .stream()
                    .filter(log -> userId.equals(log.getKeycloakUserId()))
                    .toList();
        } else {
            // Utilisateur sans organisation, récupérer tous ses logs
            userLogs = usageLogRepository.findByKeycloakUserIdAndTimestampBetween(userId, startDateTime, endDateTime);
        }

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
        
        List<UsageLog> monthlyLogs;
        if (organizationId != null) {
            monthlyLogs = usageLogRepository.findByOrganizationIdAndTimestampBetween(organizationId, startOfMonth, endOfMonth)
                    .stream()
                    .filter(log -> userId.equals(log.getKeycloakUserId()))
                    .toList();
        } else {
            monthlyLogs = usageLogRepository.findByKeycloakUserIdAndTimestampBetween(userId, startOfMonth, endOfMonth);
        }
        long monthlyRequests = monthlyLogs.size();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalRequests", totalRequests);
        stats.put("totalCostUsd", totalCost.doubleValue());
        stats.put("totalTokens", totalTokens);
        stats.put("monthlyRequests", monthlyRequests);
        stats.put("recentUsage", recentUsage);
        
        // Ajouter les informations de quota si l'utilisateur a une organisation
        if (organizationId != null) {
            OrganizationDto organization = organizationService.getOrganizationById(organizationId);
            if (organization != null) {
                // Calculer l'utilisation totale de l'organisation ce mois (réutiliser startOfMonth et endOfMonth)
                long organizationMonthlyUsage = usageLogRepository.countByOrganizationIdAndTimestampBetween(organizationId, startOfMonth, endOfMonth);
                
                Map<String, Object> quotaInfo = new LinkedHashMap<>();
                quotaInfo.put("monthlyQuota", organization.getMonthlyQuota());
                quotaInfo.put("currentUsage", organizationMonthlyUsage); // Usage total de l'organisation
                quotaInfo.put("personalUsage", monthlyRequests); // Usage personnel
                quotaInfo.put("remaining", organization.getMonthlyQuota() != null 
                        ? Math.max(0, organization.getMonthlyQuota() - organizationMonthlyUsage)
                        : -1); // -1 = illimité
                quotaInfo.put("percentageUsed", organization.getMonthlyQuota() != null && organization.getMonthlyQuota() > 0
                        ? (double) organizationMonthlyUsage / organization.getMonthlyQuota() * 100
                        : 0.0);
                stats.put("quotaInfo", quotaInfo);
            }
        }

        return ResponseEntity.ok(stats);
    }

    /**
     * Récupère l'état du quota de l'utilisateur connecté.
     */
    @GetMapping("/quota")
    @Operation(
        summary = "Récupérer l'état de mon quota",
        description = "Retourne l'état du quota mensuel de l'organisation de l'utilisateur connecté.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<Map<String, Object>> getMyQuota() {
        String userId = getCurrentUserId();
        if (userId == null) {
            return ResponseEntity.badRequest().build();
        }

        Long organizationId = organizationService.getOrganizationIdByUserId(userId);
        if (organizationId == null) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("hasOrganization", false);
            response.put("message", "Vous n'êtes associé à aucune organisation");
            return ResponseEntity.ok(response);
        }

        OrganizationDto organization = organizationService.getOrganizationById(organizationId);
        if (organization == null) {
            return ResponseEntity.notFound().build();
        }

        // Calculer l'utilisation du mois en cours
        // Note: Le quota est au niveau de l'organisation, donc on compte tous les logs de l'organisation
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startOfMonth = now.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime endOfMonth = now.withDayOfMonth(now.toLocalDate().lengthOfMonth())
                .withHour(23).withMinute(59).withSecond(59).withNano(999999999);
        
        // Le quota est partagé entre tous les utilisateurs de l'organisation
        long currentUsage = usageLogRepository.countByOrganizationIdAndTimestampBetween(organizationId, startOfMonth, endOfMonth);
        
        // Calculer aussi l'utilisation personnelle de l'utilisateur
        long personalUsage = usageLogRepository.countByKeycloakUserIdAndTimestampBetween(userId, startOfMonth, endOfMonth);

        Map<String, Object> quota = new LinkedHashMap<>();
        quota.put("hasOrganization", true);
        quota.put("organizationId", organizationId);
        quota.put("organizationName", organization.getName());
        quota.put("monthlyQuota", organization.getMonthlyQuota());
        quota.put("currentUsage", currentUsage); // Usage total de l'organisation
        quota.put("personalUsage", personalUsage); // Usage personnel de l'utilisateur
        quota.put("remaining", organization.getMonthlyQuota() != null 
                ? Math.max(0, organization.getMonthlyQuota() - currentUsage)
                : -1); // -1 = illimité
        quota.put("percentageUsed", organization.getMonthlyQuota() != null && organization.getMonthlyQuota() > 0
                ? (double) currentUsage / organization.getMonthlyQuota() * 100
                : 0.0);
        quota.put("isUnlimited", organization.getMonthlyQuota() == null);

        return ResponseEntity.ok(quota);
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

        Long organizationId = organizationService.getOrganizationIdByUserId(userId);
        if (organizationId == null) {
            return ResponseEntity.badRequest().build();
        }

        OrganizationDto organization = organizationService.changePricingPlan(organizationId, request.getPricingPlanId());
        return ResponseEntity.ok(organization);
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

