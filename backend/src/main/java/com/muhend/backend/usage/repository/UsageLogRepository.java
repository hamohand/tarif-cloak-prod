package com.muhend.backend.usage.repository;

import com.muhend.backend.usage.model.UsageLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface UsageLogRepository extends JpaRepository<UsageLog, Long> {
    
    /**
     * Récupère tous les logs d'un utilisateur.
     */
    List<UsageLog> findByKeycloakUserId(String keycloakUserId);
    
    /**
     * Récupère les logs entre deux dates.
     */
    List<UsageLog> findByTimestampBetween(LocalDateTime start, LocalDateTime end);
    
    /**
     * Récupère les logs d'un utilisateur entre deux dates.
     */
    List<UsageLog> findByKeycloakUserIdAndTimestampBetween(
        String keycloakUserId, 
        LocalDateTime start, 
        LocalDateTime end
    );
    
    /**
     * Compte le nombre de logs d'un utilisateur entre deux dates.
     */
    long countByKeycloakUserIdAndTimestampBetween(
        String keycloakUserId,
        LocalDateTime start,
        LocalDateTime end
    );
}

