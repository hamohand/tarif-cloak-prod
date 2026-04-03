package com.muhend.backend.organization.service;

import com.muhend.backend.invoice.service.InvoiceService;
import com.muhend.backend.organization.dto.QuotaCheckResult;
import com.muhend.backend.organization.model.Organization;
import com.muhend.backend.organization.repository.OrganizationRepository;
import com.muhend.backend.pricing.dto.PricingPlanDto;
import com.muhend.backend.pricing.service.PricingPlanService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Service pour gérer les cycles mensuels des plans tarifaires.
 * S'exécute quotidiennement pour :
 * 1. Appliquer les changements de plan mensuel en attente
 * 2. Reconduire automatiquement les plans mensuels expirés
 */
@Service
@Slf4j
public class MonthlyPlanSchedulerService {
    
    private final OrganizationRepository organizationRepository;
    private final PricingPlanService pricingPlanService;
    private final InvoiceService invoiceService;
    private final QuotaService quotaService;
    private final PlanChangeService planChangeService;
    
    public MonthlyPlanSchedulerService(
            OrganizationRepository organizationRepository,
            PricingPlanService pricingPlanService,
            InvoiceService invoiceService,
            QuotaService quotaService,
            PlanChangeService planChangeService) {
        this.organizationRepository = organizationRepository;
        this.pricingPlanService = pricingPlanService;
        this.invoiceService = invoiceService;
        this.quotaService = quotaService;
        this.planChangeService = planChangeService;
    }
    
    /**
     * S'exécute tous les jours à minuit pour :
     * 1. Appliquer les changements de plan mensuel en attente
     * 2. Reconduire automatiquement les plans mensuels expirés
     */
    @Scheduled(cron = "0 0 0 * * ?") // Tous les jours à minuit
    @Transactional
    public void processMonthlyPlanCycles() {
        LocalDate today = LocalDate.now();
        log.info("🔄 Traitement des cycles mensuels des plans tarifaires pour la date: {}", today);
        
        // 1. Appliquer les changements de plan en attente
        List<Organization> orgsWithPendingChanges = organizationRepository
            .findByPendingMonthlyPlanChangeDateLessThanEqual(today);
        
        log.info("📋 Organisations avec changement de plan en attente: {}", orgsWithPendingChanges.size());
        
        for (Organization org : orgsWithPendingChanges) {
            if (org.getPendingMonthlyPlanId() != null) {
                try {
                    PricingPlanDto newPlan = pricingPlanService.getPricingPlanById(org.getPendingMonthlyPlanId());
                    applyPendingPlanChange(org, newPlan);
                    log.info("✅ Changement de plan appliqué pour l'organisation {}: nouveau plan {}", 
                            org.getId(), newPlan.getName());
                } catch (Exception e) {
                    log.error("❌ Erreur lors de l'application du changement de plan pour l'organisation {}: {}", 
                            org.getId(), e.getMessage(), e);
                }
            }
        }
        
        // 2. Reconduire automatiquement les plans mensuels expirés
        List<Organization> orgsWithExpiredCycles = organizationRepository
            .findByMonthlyPlanEndDateLessThan(today)
            .stream()
            .filter(org -> {
                return org.getPricingPlanId() != null 
                    && org.getPendingMonthlyPlanId() == null
                    && org.getMonthlyPlanEndDate() != null;
            })
            .collect(Collectors.toList());
        
        log.info("📋 Organisations avec cycle mensuel expiré à reconduire: {}", orgsWithExpiredCycles.size());
        
        for (Organization org : orgsWithExpiredCycles) {
            try {
                PricingPlanDto currentPlan = pricingPlanService.getPricingPlanById(org.getPricingPlanId());
                if (currentPlan.getPricePerMonth() != null && currentPlan.getPricePerMonth().compareTo(java.math.BigDecimal.ZERO) > 0) {
                    renewMonthlyPlanCycle(org, currentPlan);
                    log.info("✅ Plan mensuel reconduit automatiquement pour l'organisation {}: plan {}", 
                            org.getId(), currentPlan.getName());
                }
            } catch (Exception e) {
                log.error("❌ Erreur lors de la reconduction du plan pour l'organisation {}: {}", 
                        org.getId(), e.getMessage(), e);
            }
        }
        
        // 3. Appliquer les changements vers Pay-per-Request en attente (si quota dépassé OU date d'effet arrivée)
        List<Organization> orgsWithPendingPayPerRequest = organizationRepository
            .findByPendingPayPerRequestPlanIdIsNotNull();
        
        log.info("📋 Organisations avec changement vers Pay-per-Request en attente: {}", orgsWithPendingPayPerRequest.size());
        
        for (Organization org : orgsWithPendingPayPerRequest) {
            if (org.getPendingPayPerRequestPlanId() != null) {
                try {
                    QuotaCheckResult quotaCheck = quotaService.checkQuotaWithResult(org.getId());
                    boolean isQuotaExceeded = !quotaCheck.isQuotaOk();
                    boolean isChangeDateReached = org.getPendingPayPerRequestChangeDate() != null 
                            && !org.getPendingPayPerRequestChangeDate().isAfter(today);
                    
                    if (isQuotaExceeded || isChangeDateReached) {
                        PricingPlanDto newPlan = pricingPlanService.getPricingPlanById(org.getPendingPayPerRequestPlanId());
                        PricingPlanDto oldPlan = pricingPlanService.getPricingPlanById(org.getPricingPlanId());
                        
                        // Générer facture de clôture mensuelle
                        if (org.getMonthlyPlanStartDate() != null && org.getMonthlyPlanEndDate() != null) {
                            try {
                                invoiceService.generateMonthlyPlanCycleClosureInvoice(
                                    org.getId(), 
                                    oldPlan, 
                                    org.getMonthlyPlanStartDate(), 
                                    org.getMonthlyPlanEndDate()
                                );
                            } catch (Exception e) {
                                log.error("Erreur lors de la génération de la facture de clôture pour l'organisation {}: {}", 
                                        org.getId(), e.getMessage(), e);
                            }
                        }
                        
                        // Appliquer le changement
                        planChangeService.applyPlanChangeImmediately(org, newPlan);
                        org.setPendingPayPerRequestPlanId(null);
                        org.setPendingPayPerRequestChangeDate(null);
                        organizationRepository.save(org);
                        
                        log.info("✅ Changement vers Pay-per-Request appliqué pour l'organisation {}: quota dépassé={}, date atteinte={}", 
                                org.getId(), isQuotaExceeded, isChangeDateReached);
                    } else {
                        log.debug("Changement vers Pay-per-Request toujours en attente pour l'organisation {}: quota OK, date d'effet: {}", 
                                org.getId(), org.getPendingPayPerRequestChangeDate());
                    }
                } catch (Exception e) {
                    log.error("❌ Erreur lors de l'application du changement vers Pay-per-Request pour l'organisation {}: {}", 
                            org.getId(), e.getMessage(), e);
                }
            }
        }
        
        log.info("✅ Traitement des cycles mensuels terminé");
    }
    
    /**
     * Applique un changement de plan en attente.
     */
    private void applyPendingPlanChange(Organization org, PricingPlanDto newPlan) {
        // Générer facture de clôture pour l'ancien plan (cycle mensuel)
        PricingPlanDto oldPlan = pricingPlanService.getPricingPlanById(org.getPricingPlanId());
        if (oldPlan.getPricePerMonth() != null && org.getMonthlyPlanStartDate() != null) {
            try {
                invoiceService.generateMonthlyPlanCycleClosureInvoice(
                    org.getId(), 
                    oldPlan, 
                    org.getMonthlyPlanStartDate(), 
                    org.getMonthlyPlanEndDate()
                );
            } catch (Exception e) {
                log.error("Erreur lors de la génération de la facture de clôture pour l'organisation {}: {}", 
                        org.getId(), e.getMessage(), e);
            }
        }
        
        // Appliquer le nouveau plan via PlanChangeService (dédupliqué)
        planChangeService.applyPlanChangeImmediately(org, newPlan);
        planChangeService.initializeMonthlyPlanCycle(org, newPlan);
        
        // Réinitialiser le changement en attente
        org.setPendingMonthlyPlanId(null);
        org.setPendingMonthlyPlanChangeDate(null);
        
        organizationRepository.save(org);
    }
    
    /**
     * Reconduit automatiquement un cycle mensuel avec le même plan.
     */
    private void renewMonthlyPlanCycle(Organization org, PricingPlanDto plan) {
        // Générer facture pour le cycle expiré
        if (org.getMonthlyPlanStartDate() != null && org.getMonthlyPlanEndDate() != null) {
            try {
                invoiceService.generateMonthlyPlanCycleInvoice(
                    org.getId(),
                    plan,
                    org.getMonthlyPlanStartDate(),
                    org.getMonthlyPlanEndDate()
                );
            } catch (Exception e) {
                log.error("Erreur lors de la génération de la facture de reconduction pour l'organisation {}: {}", 
                        org.getId(), e.getMessage(), e);
            }
        }
        
        // Réinitialiser le cycle via PlanChangeService (dédupliqué)
        planChangeService.initializeMonthlyPlanCycle(org, plan);
        organizationRepository.save(org);
    }
}
