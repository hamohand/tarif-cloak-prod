package com.muhend.backend.admin.controller;

import com.muhend.backend.admin.service.EndpointDiscoveryService;
import com.muhend.backend.organization.dto.OrganizationDto;
import com.muhend.backend.organization.service.OrganizationService;
import com.muhend.backend.usage.model.UsageLog;
import com.muhend.backend.usage.service.UsageLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
@Tag(name = "Admin", description = "Endpoints d'administration (nécessite le rôle ADMIN)")
public class AdminController {

    private final EndpointDiscoveryService endpointDiscoveryService;
    private final UsageLogService usageLogService;
    private final OrganizationService organizationService;

    @GetMapping("/endpoints")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
        summary = "Lister tous les endpoints du backend",
        description = "Retourne la liste de tous les endpoints disponibles dans l'application. Nécessite le rôle ADMIN.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<Map<String, Object>> listEndpoints() {
        List<Map<String, Object>> endpoints = endpointDiscoveryService.discoverEndpoints();
        
        return ResponseEntity.ok(Map.of(
            "total", endpoints.size(),
            "endpoints", endpoints
        ));
    }

    @GetMapping("/endpoints/admin-only")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
        summary = "Lister les endpoints accessibles uniquement par ADMIN",
        description = "Retourne la liste des endpoints qui nécessitent exclusivement le rôle ADMIN. Utile pour vérifier les autorisations.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<Map<String, Object>> listAdminOnlyEndpoints() {
        List<Map<String, Object>> adminEndpoints = endpointDiscoveryService.discoverAdminOnlyEndpoints();
        
        return ResponseEntity.ok(Map.of(
            "total", adminEndpoints.size(),
            "role", "ADMIN",
            "description", "Endpoints accessibles uniquement par les utilisateurs avec le rôle ADMIN",
            "endpoints", adminEndpoints
        ));
    }

    @GetMapping("/endpoints/by-role")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
        summary = "Lister les endpoints par rôle",
        description = "Retourne la liste des endpoints qui nécessitent un rôle spécifique. Paramètre: ?role=ADMIN ou ?role=USER",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<Map<String, Object>> listEndpointsByRole(
            @RequestParam(defaultValue = "ADMIN") String role) {
        List<Map<String, Object>> endpoints = endpointDiscoveryService.discoverEndpointsByRole(role);
        
        return ResponseEntity.ok(Map.of(
            "total", endpoints.size(),
            "role", role.toUpperCase(),
            "description", "Endpoints nécessitant le rôle " + role.toUpperCase(),
            "endpoints", endpoints
        ));
    }

    @GetMapping("/usage-logs")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
        summary = "Consulter les logs d'utilisation",
        description = "Retourne la liste des logs d'utilisation des recherches. " +
                     "Paramètres optionnels: ?userId=... pour filtrer par utilisateur, " +
                     "?organizationId=... pour filtrer par organisation, " +
                     "?startDate=... et ?endDate=... pour filtrer par période (format: yyyy-MM-dd).",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<Map<String, Object>> getUsageLogs(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) Long organizationId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        
        List<UsageLog> logs;
        
        if (organizationId != null && startDate != null && endDate != null) {
            // Filtre par organisation et période
            LocalDateTime start = startDate.atStartOfDay();
            LocalDateTime end = endDate.atTime(LocalTime.MAX);
            logs = usageLogService.getUsageLogsByOrganizationAndDateRange(organizationId, start, end);
        } else if (organizationId != null) {
            // Filtre par organisation uniquement
            logs = usageLogService.getUsageLogsByOrganization(organizationId);
        } else if (userId != null && startDate != null && endDate != null) {
            // Filtre par utilisateur et période
            LocalDateTime start = startDate.atStartOfDay();
            LocalDateTime end = endDate.atTime(LocalTime.MAX);
            logs = usageLogService.getUsageLogsByUserAndDateRange(userId, start, end);
        } else if (userId != null) {
            // Filtre par utilisateur uniquement
            logs = usageLogService.getUsageLogsByUser(userId);
        } else if (startDate != null && endDate != null) {
            // Filtre par période uniquement
            LocalDateTime start = startDate.atStartOfDay();
            LocalDateTime end = endDate.atTime(LocalTime.MAX);
            logs = usageLogService.getUsageLogsByDateRange(start, end);
        } else {
            // Tous les logs
            logs = usageLogService.getAllUsageLogs();
        }
        
        // Calculer les statistiques
        long totalRequests = logs.size();
        BigDecimal totalCost = logs.stream()
            .map(log -> log.getCostUsd() != null ? log.getCostUsd() : BigDecimal.ZERO)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        long totalTokens = logs.stream()
            .mapToLong(log -> log.getTokensUsed() != null ? log.getTokensUsed() : 0L)
            .sum();
        
        return ResponseEntity.ok(Map.of(
            "total", totalRequests,
            "totalCostUsd", totalCost.doubleValue(),
            "totalTokens", totalTokens,
            "logs", logs
        ));
    }

    @GetMapping("/usage/stats")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
        summary = "Obtenir les statistiques d'utilisation",
        description = "Retourne les statistiques agrégées d'utilisation : " +
                     "- Nombre total de requêtes, coût total, tokens totaux " +
                     "- Statistiques par entreprise " +
                     "- Statistiques par utilisateur " +
                     "- Utilisations récentes " +
                     "Paramètres optionnels: ?organizationId=... pour filtrer par organisation, " +
                     "?startDate=... et ?endDate=... pour filtrer par période (format: yyyy-MM-dd).",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<Map<String, Object>> getUsageStats(
            @RequestParam(required = false) Long organizationId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        
        // Récupérer les logs selon les filtres
        List<UsageLog> logs;
        if (organizationId != null && startDate != null && endDate != null) {
            LocalDateTime start = startDate.atStartOfDay();
            LocalDateTime end = endDate.atTime(LocalTime.MAX);
            logs = usageLogService.getUsageLogsByOrganizationAndDateRange(organizationId, start, end);
        } else if (organizationId != null) {
            logs = usageLogService.getUsageLogsByOrganization(organizationId);
        } else if (startDate != null && endDate != null) {
            LocalDateTime start = startDate.atStartOfDay();
            LocalDateTime end = endDate.atTime(LocalTime.MAX);
            logs = usageLogService.getUsageLogsByDateRange(start, end);
        } else {
            logs = usageLogService.getAllUsageLogs();
        }
        
        // Statistiques globales
        long totalRequests = logs.size();
        BigDecimal totalCost = logs.stream()
            .map(log -> log.getCostUsd() != null ? log.getCostUsd() : BigDecimal.ZERO)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        long totalTokens = logs.stream()
            .mapToLong(log -> log.getTokensUsed() != null ? log.getTokensUsed() : 0L)
            .sum();
        
        // Statistiques par entreprise
        List<Map<String, Object>> statsByOrganization = getStatsByOrganization(logs);
        
        // Statistiques par utilisateur
        List<Map<String, Object>> statsByUser = getStatsByUser(logs);
        
        // Utilisations récentes (10 dernières)
        List<Map<String, Object>> recentUsage = logs.stream()
            .sorted(Comparator.comparing(UsageLog::getTimestamp).reversed())
            .limit(10)
            .map(this::toUsageLogMap)
            .collect(Collectors.toList());
        
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalRequests", totalRequests);
        stats.put("totalCostUsd", totalCost.doubleValue());
        stats.put("totalTokens", totalTokens);
        stats.put("statsByOrganization", statsByOrganization);
        stats.put("statsByUser", statsByUser);
        stats.put("recentUsage", recentUsage);
        
        return ResponseEntity.ok(stats);
    }
    
    /**
     * Calcule les statistiques par entreprise.
     */
    private List<Map<String, Object>> getStatsByOrganization(List<UsageLog> logs) {
        // Récupérer toutes les organisations
        List<OrganizationDto> organizations = organizationService.getAllOrganizations();
        
        Map<Long, Map<String, Object>> orgStatsMap = new HashMap<>();
        
        // Initialiser les stats pour chaque organisation
        for (OrganizationDto org : organizations) {
            Map<String, Object> orgStats = new HashMap<>();
            orgStats.put("organizationId", org.getId());
            orgStats.put("organizationName", org.getName());
            orgStats.put("requestCount", 0L);
            orgStats.put("totalCostUsd", 0.0);
            orgStats.put("totalTokens", 0L);
            orgStatsMap.put(org.getId(), orgStats);
        }
        
        // Agrégation des logs par organisation
        for (UsageLog log : logs) {
            if (log.getOrganizationId() != null) {
                Map<String, Object> orgStats = orgStatsMap.get(log.getOrganizationId());
                if (orgStats != null) {
                    orgStats.put("requestCount", ((Long) orgStats.get("requestCount")) + 1);
                    BigDecimal currentCost = BigDecimal.valueOf((Double) orgStats.get("totalCostUsd"));
                    BigDecimal logCost = log.getCostUsd() != null ? log.getCostUsd() : BigDecimal.ZERO;
                    orgStats.put("totalCostUsd", currentCost.add(logCost).doubleValue());
                    orgStats.put("totalTokens", ((Long) orgStats.get("totalTokens")) + 
                                (log.getTokensUsed() != null ? log.getTokensUsed() : 0L));
                }
            }
        }
        
        // Convertir en liste et filtrer les organisations sans requêtes
        return orgStatsMap.values().stream()
            .filter(stats -> ((Long) stats.get("requestCount")) > 0)
            .sorted((a, b) -> Long.compare((Long) b.get("requestCount"), (Long) a.get("requestCount")))
            .collect(Collectors.toList());
    }
    
    /**
     * Calcule les statistiques par utilisateur.
     */
    private List<Map<String, Object>> getStatsByUser(List<UsageLog> logs) {
        Map<String, Map<String, Object>> userStatsMap = new HashMap<>();
        
        // Agrégation des logs par utilisateur
        for (UsageLog log : logs) {
            String userId = log.getKeycloakUserId();
            if (userId != null) {
                Map<String, Object> userStats = userStatsMap.computeIfAbsent(userId, k -> {
                    Map<String, Object> stats = new HashMap<>();
                    stats.put("keycloakUserId", userId);
                    stats.put("requestCount", 0L);
                    stats.put("totalCostUsd", 0.0);
                    stats.put("totalTokens", 0L);
                    return stats;
                });
                
                userStats.put("requestCount", ((Long) userStats.get("requestCount")) + 1);
                BigDecimal currentCost = BigDecimal.valueOf((Double) userStats.get("totalCostUsd"));
                BigDecimal logCost = log.getCostUsd() != null ? log.getCostUsd() : BigDecimal.ZERO;
                userStats.put("totalCostUsd", currentCost.add(logCost).doubleValue());
                userStats.put("totalTokens", ((Long) userStats.get("totalTokens")) + 
                            (log.getTokensUsed() != null ? log.getTokensUsed() : 0L));
            }
        }
        
        // Convertir en liste et trier par nombre de requêtes décroissant
        return userStatsMap.values().stream()
            .sorted((a, b) -> Long.compare((Long) b.get("requestCount"), (Long) a.get("requestCount")))
            .collect(Collectors.toList());
    }
    
    /**
     * Convertit un UsageLog en Map pour la réponse JSON.
     */
    private Map<String, Object> toUsageLogMap(UsageLog log) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", log.getId());
        map.put("keycloakUserId", log.getKeycloakUserId());
        map.put("organizationId", log.getOrganizationId());
        map.put("endpoint", log.getEndpoint());
        map.put("searchTerm", log.getSearchTerm());
        map.put("tokensUsed", log.getTokensUsed());
        map.put("costUsd", log.getCostUsd() != null ? log.getCostUsd().doubleValue() : null);
        map.put("timestamp", log.getTimestamp());
        return map;
    }
}

