package com.muhend.backend.admin.controller;

import com.muhend.backend.admin.service.OrganizationDeletionService;
import com.muhend.backend.auth.model.PendingRegistration;
import com.muhend.backend.auth.service.PendingRegistrationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Contrôleur admin pour les opérations de maintenance
 * ⚠️ ATTENTION : Toutes les opérations sont irréversibles !
 */
@RestController
@RequestMapping("/admin")
public class AdminController {
    
    private static final Logger logger = LoggerFactory.getLogger(AdminController.class);
    
    private final OrganizationDeletionService organizationDeletionService;
    private final PendingRegistrationService pendingRegistrationService;
    
    public AdminController(
        OrganizationDeletionService organizationDeletionService,
        PendingRegistrationService pendingRegistrationService
    ) {
        this.organizationDeletionService = organizationDeletionService;
        this.pendingRegistrationService = pendingRegistrationService;
    }
    
    /**
     * Supprime définitivement une organisation et tous ses éléments associés
     * ⚠️ ATTENTION : Cette opération est irréversible !
     * 
     * Supprime :
     * - Les éléments de facture (invoice_item)
     * - Les factures (invoice)
     * - Les paiements (payment)
     * - Les abonnements (subscription)
     * - Les demandes de devis (quote_request)
     * - Les logs d'utilisation (usage_log)
     * - Les alertes de quota (quota_alert)
     * - Les associations utilisateur-organisation (organization_user)
     * - L'organisation elle-même (organization)
     * 
     * @param organizationId ID de l'organisation à supprimer
     * @return Statistiques de la suppression
     */
    @DeleteMapping("/organizations/{organizationId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> deleteOrganization(@PathVariable Long organizationId) {
        logger.warn("=== DÉMARRAGE DE LA SUPPRESSION DE L'ORGANISATION {} ===", organizationId);
        logger.warn("Cette opération va supprimer définitivement l'organisation et tous ses éléments associés");
        
        try {
            OrganizationDeletionService.DeletionResult result = organizationDeletionService.deleteOrganization(organizationId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", result.isSuccess());
            response.put("message", "Organisation supprimée avec succès");
            response.put("organizationId", result.getOrganizationId());
            response.put("organizationName", result.getOrganizationName());
            response.put("deletedInvoiceItems", result.getDeletedInvoiceItems());
            response.put("deletedInvoices", result.getDeletedInvoices());
            response.put("deletedPayments", result.getDeletedPayments());
            response.put("deletedSubscriptions", result.getDeletedSubscriptions());
            response.put("deletedQuoteRequests", result.getDeletedQuoteRequests());
            response.put("deletedUsageLogs", result.getDeletedUsageLogs());
            response.put("deletedQuotaAlerts", result.getDeletedQuotaAlerts());
            response.put("deletedOrganizationUsers", result.getDeletedOrganizationUsers());
            
            logger.info("Suppression terminée: organisation {} supprimée", result.getOrganizationName());
            
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            logger.error("Organisation non trouvée: {}", e.getMessage());
            return ResponseEntity.status(404).body(Map.of(
                "success", false,
                "error", e.getMessage()
            ));
        } catch (Exception e) {
            logger.error("Erreur lors de la suppression de l'organisation {}", organizationId, e);
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", "Erreur lors de la suppression: " + e.getMessage()
            ));
        }
    }

    /**
     * Récupère tous les utilisateurs en attente d'inscription
     * @return Liste des inscriptions en attente
     */
    @GetMapping("/pending-registrations")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<PendingRegistration>> getPendingRegistrations() {
        logger.info("Récupération de tous les utilisateurs en attente d'inscription");
        List<PendingRegistration> pending = pendingRegistrationService.getAllPendingRegistrations();
        return ResponseEntity.ok(pending);
    }
    
    /**
     * Supprime une inscription en attente spécifique
     * @param id ID de l'inscription en attente à supprimer
     * @return Message de confirmation
     */
    @DeleteMapping("/pending-registrations/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> deletePendingRegistration(@PathVariable Long id) {
        logger.info("Suppression de l'inscription en attente avec l'ID: {}", id);
        try {
            pendingRegistrationService.deletePendingRegistration(id);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Inscription en attente supprimée avec succès"
            ));
        } catch (IllegalArgumentException e) {
            logger.error("Inscription en attente non trouvée: {}", e.getMessage());
            return ResponseEntity.status(404).body(Map.of(
                "success", false,
                "error", e.getMessage()
            ));
        } catch (Exception e) {
            logger.error("Erreur lors de la suppression de l'inscription en attente {}", id, e);
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", "Erreur lors de la suppression: " + e.getMessage()
            ));
        }
    }
    
    /**
     * Supprime toutes les inscriptions en attente expirées
     * @return Nombre d'inscriptions supprimées
     */
    @DeleteMapping("/pending-registrations/expired")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> deleteExpiredPendingRegistrations() {
        logger.info("Suppression de toutes les inscriptions en attente expirées");
        try {
            pendingRegistrationService.cleanupExpiredRegistrations();
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Nettoyage des inscriptions expirées terminé"
            ));
        } catch (Exception e) {
            logger.error("Erreur lors du nettoyage des inscriptions expirées", e);
            return ResponseEntity.status(500).body(Map.of(
                "success", false,
                "error", "Erreur lors du nettoyage: " + e.getMessage()
            ));
        }
    }
}
