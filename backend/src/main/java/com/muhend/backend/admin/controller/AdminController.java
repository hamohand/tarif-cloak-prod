package com.muhend.backend.admin.controller;

import com.muhend.backend.admin.service.EndpointDiscoveryService;
import com.muhend.backend.auth.service.KeycloakAdminService;
import com.muhend.backend.auth.service.PendingRegistrationService;
import com.muhend.backend.organization.dto.OrganizationDto;
import com.muhend.backend.organization.service.OrganizationService;
import com.muhend.backend.organization.repository.OrganizationUserRepository;
import com.muhend.backend.organization.repository.OrganizationRepository;
import com.muhend.backend.invoice.repository.InvoiceRepository;
import com.muhend.backend.invoice.repository.InvoiceItemRepository;
import com.muhend.backend.auth.repository.PendingRegistrationRepository;
import com.muhend.backend.usage.model.UsageLog;
import com.muhend.backend.usage.repository.UsageLogRepository;
import com.muhend.backend.usage.service.UsageLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
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
@Slf4j
@Tag(name = "Admin", description = "Endpoints d'administration (nécessite le rôle ADMIN)")
public class AdminController {

    private final EndpointDiscoveryService endpointDiscoveryService;
    private final UsageLogService usageLogService;
    private final OrganizationService organizationService;
    private final KeycloakAdminService keycloakAdminService;
    private final OrganizationUserRepository organizationUserRepository;
    private final OrganizationRepository organizationRepository;
    private final UsageLogRepository usageLogRepository;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceItemRepository invoiceItemRepository;
    private final PendingRegistrationRepository pendingRegistrationRepository;
    private final PendingRegistrationService pendingRegistrationService;

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
                    // Récupérer le nom d'utilisateur depuis Keycloak
                    try {
                        String username = keycloakAdminService.getUsername(userId);
                        stats.put("username", username != null ? username : "N/A");
                    } catch (Exception e) {
                        stats.put("username", "N/A");
                    }
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
        // Récupérer le nom d'utilisateur depuis Keycloak
        try {
            String username = keycloakAdminService.getUsername(log.getKeycloakUserId());
            map.put("username", username != null ? username : "N/A");
        } catch (Exception e) {
            map.put("username", "N/A");
        }
        map.put("organizationId", log.getOrganizationId());
        map.put("endpoint", log.getEndpoint());
        map.put("searchTerm", log.getSearchTerm());
        map.put("tokensUsed", log.getTokensUsed());
        map.put("costUsd", log.getCostUsd() != null ? log.getCostUsd().doubleValue() : null);
        map.put("timestamp", log.getTimestamp());
        return map;
    }
    
    /**
     * Liste les utilisateurs qui ont des logs d'utilisation mais qui ne sont pas associés à une organisation.
     * Utile pour identifier les utilisateurs à associer à une organisation.
     */
    @GetMapping("/users/without-organization")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
        summary = "Lister les utilisateurs sans organisation",
        description = "Retourne la liste des utilisateurs qui ont des logs d'utilisation mais qui ne sont pas associés à une organisation. " +
                     "Ces utilisateurs doivent être associés à une organisation pour fonctionner correctement. " +
                     "Nécessite le rôle ADMIN.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<Map<String, Object>> getUsersWithoutOrganization() {
        // Récupérer tous les utilisateurs qui ont des logs d'utilisation
        List<UsageLog> allLogs = usageLogRepository.findAll();
        Set<String> usersWithLogs = allLogs.stream()
                .map(UsageLog::getKeycloakUserId)
                .filter(userId -> userId != null && !userId.trim().isEmpty())
                .collect(java.util.stream.Collectors.toSet());
        
        // Récupérer tous les utilisateurs qui sont associés à une organisation
        List<com.muhend.backend.organization.model.OrganizationUser> allOrganizationUsers = 
                organizationUserRepository.findAll();
        Set<String> usersWithOrganization = allOrganizationUsers.stream()
                .map(com.muhend.backend.organization.model.OrganizationUser::getKeycloakUserId)
                .filter(userId -> userId != null && !userId.trim().isEmpty())
                .collect(java.util.stream.Collectors.toSet());
        
        // Trouver les utilisateurs qui ont des logs mais pas d'organisation
        List<Map<String, Object>> usersWithoutOrganization = usersWithLogs.stream()
                .filter(userId -> !usersWithOrganization.contains(userId))
                .map(userId -> {
                    Map<String, Object> userInfo = new HashMap<>();
                    userInfo.put("keycloakUserId", userId);
                    try {
                        String username = keycloakAdminService.getUsername(userId);
                        String email = keycloakAdminService.getUserEmail(userId);
                        userInfo.put("username", username != null ? username : "N/A");
                        userInfo.put("email", email != null ? email : "N/A");
                    } catch (Exception e) {
                        userInfo.put("username", "N/A");
                        userInfo.put("email", "N/A");
                    }
                    // Compter les logs de cet utilisateur
                    long logCount = allLogs.stream()
                            .filter(log -> userId.equals(log.getKeycloakUserId()))
                            .count();
                    userInfo.put("logCount", logCount);
                    return userInfo;
                })
                .sorted((a, b) -> Long.compare((Long) b.get("logCount"), (Long) a.get("logCount")))
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(Map.of(
            "total", usersWithoutOrganization.size(),
            "users", usersWithoutOrganization,
            "message", usersWithoutOrganization.isEmpty() 
                ? "Tous les utilisateurs avec des logs d'utilisation sont associés à une organisation."
                : "Ces utilisateurs doivent être associés à une organisation pour fonctionner correctement."
        ));
    }
    
    /**
     * Réinitialise toutes les données de test (organisations, utilisateurs, factures, logs, inscriptions en attente).
     * ATTENTION: Cette opération est irréversible et supprime toutes les données de test.
     * Les plans tarifaires ne sont PAS supprimés.
     * Utile pour la période de test.
     */
    @DeleteMapping("/reset-test-data")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
        summary = "Réinitialiser toutes les données de test",
        description = "Supprime toutes les données de test : organisations, associations utilisateurs-organisations, " +
                     "factures, logs d'utilisation, et inscriptions en attente. " +
                     "ATTENTION: Cette opération est irréversible. Les plans tarifaires ne sont PAS supprimés. " +
                     "Nécessite le rôle ADMIN.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<Map<String, Object>> resetTestData() {
        try {
            // Compter les données avant suppression
            long organizationCount = organizationRepository.count();
            long organizationUserCount = organizationUserRepository.count();
            long invoiceCount = invoiceRepository.count();
            long invoiceItemCount = invoiceItemRepository.count();
            long usageLogCount = usageLogRepository.count();
            long pendingRegistrationCount = pendingRegistrationRepository.count();
            
            // Supprimer dans l'ordre pour respecter les contraintes de clés étrangères
            // 1. Supprimer les items de facture
            invoiceItemRepository.deleteAll();
            
            // 2. Supprimer les factures
            invoiceRepository.deleteAll();
            
            // 3. Supprimer les logs d'utilisation
            usageLogRepository.deleteAll();
            
            // 4. Supprimer les associations utilisateurs-organisations
            organizationUserRepository.deleteAll();
            
            // 5. Supprimer les organisations
            organizationRepository.deleteAll();
            
            // 6. Supprimer les inscriptions en attente
            pendingRegistrationRepository.deleteAll();
            
            return ResponseEntity.ok(Map.of(
                "message", "Toutes les données de test ont été supprimées avec succès",
                "deleted", Map.of(
                    "organizations", organizationCount,
                    "organizationUsers", organizationUserCount,
                    "invoices", invoiceCount,
                    "invoiceItems", invoiceItemCount,
                    "usageLogs", usageLogCount,
                    "pendingRegistrations", pendingRegistrationCount
                ),
                "note", "Les plans tarifaires n'ont pas été supprimés. " +
                        "Vous devez également supprimer les utilisateurs Keycloak manuellement si nécessaire."
            ));
        } catch (Exception e) {
            log.error("Erreur lors de la réinitialisation des données de test: {}", e.getMessage(), e);
            return ResponseEntity.status(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of(
                    "error", "Erreur lors de la réinitialisation des données de test",
                    "message", e.getMessage()
                ));
        }
    }
    
    /**
     * Nettoie les inscriptions expirées (non confirmées depuis plus de 24h).
     * Nécessite le rôle ADMIN.
     */
    @DeleteMapping("/pending-registrations/cleanup-expired")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
        summary = "Nettoyer les inscriptions expirées",
        description = "Supprime toutes les inscriptions en attente qui ont expiré (non confirmées depuis plus de 24h). " +
                     "Nécessite le rôle ADMIN.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<Map<String, Object>> cleanupExpiredPendingRegistrations() {
        try {
            long countBefore = pendingRegistrationRepository.count();
            pendingRegistrationService.cleanupExpiredRegistrations();
            long countAfter = pendingRegistrationRepository.count();
            long deletedCount = countBefore - countAfter;
            
            return ResponseEntity.ok(Map.of(
                "message", "Inscriptions expirées supprimées avec succès",
                "deletedCount", deletedCount,
                "remainingCount", countAfter
            ));
        } catch (Exception e) {
            log.error("Erreur lors du nettoyage des inscriptions expirées: {}", e.getMessage(), e);
            return ResponseEntity.status(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of(
                    "error", "Erreur lors du nettoyage des inscriptions expirées",
                    "message", e.getMessage()
                ));
        }
    }
    
    /**
     * Supprime toutes les inscriptions en attente (expirées ou non).
     * ATTENTION: Cette opération est irréversible.
     * Nécessite le rôle ADMIN.
     */
    @DeleteMapping("/pending-registrations/cleanup-all")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
        summary = "Supprimer toutes les inscriptions en attente",
        description = "Supprime toutes les inscriptions en attente, qu'elles soient expirées ou non. " +
                     "ATTENTION: Cette opération est irréversible. Nécessite le rôle ADMIN.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<Map<String, Object>> cleanupAllPendingRegistrations() {
        try {
            long deletedCount = pendingRegistrationService.deleteAllPendingRegistrations();
            
            return ResponseEntity.ok(Map.of(
                "message", "Toutes les inscriptions en attente ont été supprimées",
                "deletedCount", deletedCount
            ));
        } catch (Exception e) {
            log.error("Erreur lors de la suppression de toutes les inscriptions en attente: {}", e.getMessage(), e);
            return ResponseEntity.status(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of(
                    "error", "Erreur lors de la suppression des inscriptions en attente",
                    "message", e.getMessage()
                ));
        }
    }
}

