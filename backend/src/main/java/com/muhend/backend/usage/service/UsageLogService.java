package com.muhend.backend.usage.service;

import com.muhend.backend.usage.model.UsageLog;
import com.muhend.backend.usage.repository.UsageLogRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Service pour gérer les logs d'utilisation.
 * Phase 1 MVP : Enregistrement simple des recherches.
 */
@Service
@Slf4j
public class UsageLogService {
    
    private final UsageLogRepository repository;
    
    public UsageLogService(UsageLogRepository repository) {
        this.repository = repository;
    }
    
    /**
     * Enregistre un log d'utilisation.
     * @param keycloakUserId ID de l'utilisateur Keycloak
     * @param endpoint Endpoint appelé (ex: "/recherche/sections")
     * @param searchTerm Terme de recherche
     * @param tokens Nombre de tokens utilisés
     * @param costUsd Coût en USD
     */
    @Transactional
    public void logUsage(String keycloakUserId, String endpoint, String searchTerm, 
                        Integer tokens, Double costUsd) {
        try {
            UsageLog usageLog = new UsageLog();
            usageLog.setKeycloakUserId(keycloakUserId);
            usageLog.setEndpoint(endpoint);
            usageLog.setSearchTerm(searchTerm);
            usageLog.setTokensUsed(tokens);
            usageLog.setCostUsd(costUsd);
            usageLog.setTimestamp(LocalDateTime.now());
            
            repository.save(usageLog);
            log.debug("Usage log enregistré pour l'utilisateur: {}, endpoint: {}, coût: {} USD", 
                     keycloakUserId, endpoint, costUsd != null ? costUsd : 0.0);
        } catch (Exception e) {
            // Ne pas faire échouer la requête si le logging échoue
            log.error("Erreur lors de l'enregistrement du log d'utilisation", e);
        }
    }
    
    /**
     * Récupère tous les logs d'un utilisateur.
     */
    public List<UsageLog> getUsageLogsByUser(String keycloakUserId) {
        return repository.findByKeycloakUserId(keycloakUserId);
    }
    
    /**
     * Récupère les logs entre deux dates.
     */
    public List<UsageLog> getUsageLogsByDateRange(LocalDateTime start, LocalDateTime end) {
        return repository.findByTimestampBetween(start, end);
    }
    
    /**
     * Récupère les logs d'un utilisateur entre deux dates.
     */
    public List<UsageLog> getUsageLogsByUserAndDateRange(String keycloakUserId, 
                                                          LocalDateTime start, 
                                                          LocalDateTime end) {
        return repository.findByKeycloakUserIdAndTimestampBetween(keycloakUserId, start, end);
    }
    
    /**
     * Récupère tous les logs (pour l'admin).
     */
    public List<UsageLog> getAllUsageLogs() {
        return repository.findAll();
    }
}

