package com.muhend.backend.admin.controller;

import com.muhend.backend.admin.service.UserCleanupService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Contrôleur admin pour les opérations de maintenance
 * ⚠️ ATTENTION : Toutes les opérations sont irréversibles !
 */
@RestController
@RequestMapping("/admin")
public class AdminController {
    
    private static final Logger logger = LoggerFactory.getLogger(AdminController.class);
    
    private final UserCleanupService userCleanupService;
    
    public AdminController(UserCleanupService userCleanupService) {
        this.userCleanupService = userCleanupService;
    }
    
    /**
     * Nettoie tous les utilisateurs avec les rôles ORGANIZATION ou COLLABORATOR
     * ⚠️ ATTENTION : Cette opération est irréversible !
     * 
     * Supprime :
     * - Les logs d'utilisation (usage_log)
     * - Les alertes de quota (quota_alert)
     * - Les associations utilisateur-organisation (organization_user)
     * - Les utilisateurs dans Keycloak
     * 
     * @return Statistiques du nettoyage
     */
    @PostMapping("/cleanup/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> cleanupUsers() {
        logger.warn("=== DÉMARRAGE DU NETTOYAGE DES UTILISATEURS ===");
        logger.warn("Cette opération va supprimer tous les utilisateurs avec les rôles ORGANIZATION ou COLLABORATOR");
        
        try {
            UserCleanupService.CleanupResult result = userCleanupService.cleanupUsersWithRoles();
            
            Map<String, Object> response = Map.of(
                "success", true,
                "message", "Nettoyage terminé",
                "deletedCount", result.getDeletedCount(),
                "errorCount", result.getErrorCount(),
                "totalFound", result.getTotalFound()
            );
            
            logger.info("Nettoyage terminé: {} utilisateurs supprimés, {} erreurs", 
                result.getDeletedCount(), result.getErrorCount());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Erreur lors du nettoyage des utilisateurs", e);
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", "Erreur lors du nettoyage: " + e.getMessage()
            ));
        }
    }
}
