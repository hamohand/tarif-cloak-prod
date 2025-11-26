package com.muhend.backend.alert.service;

import com.muhend.backend.alert.dto.QuotaAlertDto;
import com.muhend.backend.alert.model.QuotaAlert;
import com.muhend.backend.alert.repository.QuotaAlertRepository;
import com.muhend.backend.organization.dto.OrganizationDto;
import com.muhend.backend.organization.service.OrganizationService;
import com.muhend.backend.usage.repository.UsageLogRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Service pour gérer les alertes de quota.
 * Détecte automatiquement les organisations dont le quota approche ou dépasse la limite.
 */
@Service
@Slf4j
public class QuotaAlertService {
    
    private final QuotaAlertRepository quotaAlertRepository;
    private final OrganizationService organizationService;
    private final UsageLogRepository usageLogRepository;
    
    // Seuils d'alerte
    private static final double WARNING_THRESHOLD = 80.0;  // Alerte à 80%
    private static final double CRITICAL_THRESHOLD = 100.0; // Alerte à 100%
    
    public QuotaAlertService(
            QuotaAlertRepository quotaAlertRepository,
            OrganizationService organizationService,
            UsageLogRepository usageLogRepository) {
        this.quotaAlertRepository = quotaAlertRepository;
        this.organizationService = organizationService;
        this.usageLogRepository = usageLogRepository;
    }
    
    /**
     * Vérifie les quotas de toutes les organisations et crée des alertes si nécessaire.
     * Cette méthode est appelée automatiquement toutes les heures.
     */
    @Scheduled(fixedRate = 3600000) // Toutes les heures (3600000 ms)
    @Transactional
    public void checkAllOrganizations() {
        log.debug("Vérification automatique des quotas pour toutes les organisations");
        List<OrganizationDto> organizations = organizationService.getAllOrganizations();
        
        for (OrganizationDto org : organizations) {
            if (org.getMonthlyQuota() != null) {
                checkOrganizationQuota(org.getId());
            }
        }
    }
    
    /**
     * Vérifie le quota d'une organisation spécifique et crée une alerte si nécessaire.
     * 
     * IMPORTANT : Les alertes sont basées sur :
     * - La consommation de l'organisation : somme de toutes les requêtes de tous les collaborateurs
     * - Le quota de l'organisation : défini par le plan tarifaire choisi (organization.monthlyQuota)
     * 
     * Les alertes affichent uniquement : consommation-organisation / quota-organisation
     * Les alertes sont visibles par tous les collaborateurs de l'organisation.
     */
    @Transactional
    public void checkOrganizationQuota(Long organizationId) {
        OrganizationDto organization = organizationService.getOrganizationById(organizationId);
        if (organization == null || organization.getMonthlyQuota() == null) {
            return; // Pas de quota à vérifier
        }
        
        // Le quota provient du plan tarifaire de l'organisation (organization.monthlyQuota)
        // qui est défini lors du changement de plan ou à la création de l'organisation
        
        // Calculer la consommation du mois en cours pour TOUTE l'organisation
        // (somme de toutes les requêtes de tous les collaborateurs)
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startOfMonth = now.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime endOfMonth = now.withDayOfMonth(now.toLocalDate().lengthOfMonth())
                .withHour(23).withMinute(59).withSecond(59).withNano(999999999);
        
        long currentUsage = usageLogRepository.countByOrganizationIdAndTimestampBetween(
                organizationId, startOfMonth, endOfMonth);
        
        // Calculer le pourcentage : consommation-organisation / quota-organisation
        double percentageUsed = (double) currentUsage / organization.getMonthlyQuota() * 100;
        
        // Déterminer le type d'alerte
        QuotaAlert.AlertType alertType = null;
        String message = null;
        
        if (percentageUsed >= CRITICAL_THRESHOLD) {
            if (currentUsage > organization.getMonthlyQuota()) {
                alertType = QuotaAlert.AlertType.EXCEEDED;
                message = String.format(
                    "⚠️ Le quota mensuel de votre organisation '%s' a été DÉPASSÉ ! Consommation de l'organisation: %d/%d requêtes (%.1f%%)",
                    organization.getName(), currentUsage, organization.getMonthlyQuota(), percentageUsed
                );
            } else {
                alertType = QuotaAlert.AlertType.CRITICAL;
                message = String.format(
                    "🔴 Le quota mensuel de votre organisation '%s' a été ATTEINT ! Consommation de l'organisation: %d/%d requêtes (100%%)",
                    organization.getName(), currentUsage, organization.getMonthlyQuota()
                );
            }
        } else if (percentageUsed >= WARNING_THRESHOLD) {
            alertType = QuotaAlert.AlertType.WARNING;
            message = String.format(
                "🟡 Le quota mensuel de votre organisation '%s' approche de la limite ! Consommation de l'organisation: %d/%d requêtes (%.1f%%)",
                organization.getName(), currentUsage, organization.getMonthlyQuota(), percentageUsed
            );
        }
        
        // Créer une alerte si nécessaire
        if (alertType != null) {
            // Vérifier s'il existe déjà une alerte non lue du même type pour cette organisation ce mois-ci
            List<QuotaAlert> existingAlerts = quotaAlertRepository.findByOrganizationIdAndIsReadFalseOrderByCreatedAtDesc(organizationId);
            boolean shouldCreateAlert = true;
            
            // Ne créer qu'une alerte par type par mois pour éviter le spam
            for (QuotaAlert existingAlert : existingAlerts) {
                if (existingAlert.getAlertType() == alertType && 
                    existingAlert.getCreatedAt().getMonth() == now.getMonth() &&
                    existingAlert.getCreatedAt().getYear() == now.getYear()) {
                    shouldCreateAlert = false;
                    break;
                }
            }
            
            if (shouldCreateAlert) {
                QuotaAlert alert = new QuotaAlert();
                alert.setOrganizationId(organizationId);
                alert.setOrganizationName(organization.getName());
                alert.setAlertType(alertType);
                alert.setCurrentUsage(currentUsage);
                alert.setMonthlyQuota(organization.getMonthlyQuota());
                alert.setPercentageUsed(percentageUsed);
                alert.setMessage(message);
                alert.setIsRead(false);
                
                quotaAlertRepository.save(alert);
                log.info("Alerte de quota créée: {} pour l'organisation {} ({}%)", 
                        alertType, organization.getName(), String.format("%.1f", percentageUsed));
            }
        }
    }
    
    /**
     * Récupère les alertes non lues pour une organisation.
     */
    public List<QuotaAlertDto> getUnreadAlertsForOrganization(Long organizationId) {
        return quotaAlertRepository.findByOrganizationIdAndIsReadFalseOrderByCreatedAtDesc(organizationId)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Récupère toutes les alertes non lues (pour les admins).
     */
    public List<QuotaAlertDto> getAllUnreadAlerts() {
        return quotaAlertRepository.findByIsReadFalseOrderByCreatedAtDesc()
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Récupère toutes les alertes d'une organisation.
     */
    public List<QuotaAlertDto> getAllAlertsForOrganization(Long organizationId) {
        return quotaAlertRepository.findByOrganizationIdOrderByCreatedAtDesc(organizationId)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Marque une alerte comme lue.
     */
    @Transactional
    public void markAlertAsRead(Long alertId) {
        quotaAlertRepository.markAsRead(alertId);
        log.debug("Alerte {} marquée comme lue", alertId);
    }
    
    /**
     * Marque toutes les alertes d'une organisation comme lues.
     */
    @Transactional
    public void markAllAlertsAsReadForOrganization(Long organizationId) {
        quotaAlertRepository.markAllAsReadForOrganization(organizationId);
        log.debug("Toutes les alertes de l'organisation {} marquées comme lues", organizationId);
    }
    
    /**
     * Compte les alertes non lues pour une organisation.
     */
    public long countUnreadAlertsForOrganization(Long organizationId) {
        return quotaAlertRepository.countByOrganizationIdAndIsReadFalse(organizationId);
    }
    
    /**
     * Compte toutes les alertes non lues (pour les admins).
     */
    public long countAllUnreadAlerts() {
        return quotaAlertRepository.countByIsReadFalse();
    }
    
    /**
     * Convertit une QuotaAlert en DTO.
     */
    private QuotaAlertDto toDto(QuotaAlert alert) {
        QuotaAlertDto dto = new QuotaAlertDto();
        dto.setId(alert.getId());
        dto.setOrganizationId(alert.getOrganizationId());
        dto.setOrganizationName(alert.getOrganizationName());
        dto.setAlertType(alert.getAlertType());
        dto.setCurrentUsage(alert.getCurrentUsage());
        dto.setMonthlyQuota(alert.getMonthlyQuota());
        dto.setPercentageUsed(alert.getPercentageUsed());
        dto.setMessage(alert.getMessage());
        dto.setIsRead(alert.getIsRead());
        dto.setCreatedAt(alert.getCreatedAt());
        return dto;
    }
}

