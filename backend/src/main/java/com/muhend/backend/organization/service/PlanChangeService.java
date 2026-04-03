package com.muhend.backend.organization.service;

import com.muhend.backend.alert.repository.QuotaAlertRepository;
import com.muhend.backend.email.service.EmailService;
import com.muhend.backend.invoice.service.InvoiceService;
import com.muhend.backend.organization.dto.OrganizationDto;
import com.muhend.backend.organization.dto.OrganizationMapper;
import com.muhend.backend.organization.dto.QuotaCheckResult;
import com.muhend.backend.organization.model.Organization;
import com.muhend.backend.organization.model.OrganizationUser;
import com.muhend.backend.organization.repository.OrganizationRepository;
import com.muhend.backend.organization.repository.OrganizationUserRepository;
import com.muhend.backend.pricing.dto.PricingPlanDto;
import com.muhend.backend.pricing.service.PricingPlanService;
import com.muhend.backend.usage.repository.UsageLogRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service pour la gestion des changements de plan tarifaire,
 * la vérification d'expiration d'essai et la capacité d'une organisation à faire des requêtes.
 */
@Service
@Slf4j
public class PlanChangeService {

    private final OrganizationRepository organizationRepository;
    private final OrganizationUserRepository organizationUserRepository;
    private final UsageLogRepository usageLogRepository;
    private final PricingPlanService pricingPlanService;
    private final EmailService emailService;
    private final InvoiceService invoiceService;
    private final QuotaService quotaService;
    private final CollaboratorService collaboratorService;
    private final QuotaAlertRepository quotaAlertRepository;
    private final OrganizationMapper organizationMapper;

    public PlanChangeService(OrganizationRepository organizationRepository,
                             OrganizationUserRepository organizationUserRepository,
                             UsageLogRepository usageLogRepository,
                             PricingPlanService pricingPlanService,
                             EmailService emailService,
                             InvoiceService invoiceService,
                             QuotaService quotaService,
                             CollaboratorService collaboratorService,
                             QuotaAlertRepository quotaAlertRepository,
                             OrganizationMapper organizationMapper) {
        this.organizationRepository = organizationRepository;
        this.organizationUserRepository = organizationUserRepository;
        this.usageLogRepository = usageLogRepository;
        this.pricingPlanService = pricingPlanService;
        this.emailService = emailService;
        this.invoiceService = invoiceService;
        this.quotaService = quotaService;
        this.collaboratorService = collaboratorService;
        this.quotaAlertRepository = quotaAlertRepository;
        this.organizationMapper = organizationMapper;
    }

    /**
     * Change le plan tarifaire d'une organisation selon la politique de facturation.
     */
    @Transactional
    public OrganizationDto changePricingPlan(Long organizationId, Long pricingPlanId) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(
                        () -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + organizationId));

        PricingPlanDto oldPlan = null;
        if (organization.getPricingPlanId() != null) {
            try {
                oldPlan = pricingPlanService.getPricingPlanById(organization.getPricingPlanId());
            } catch (Exception e) {
                log.warn("Impossible de récupérer l'ancien plan: {}", e.getMessage());
            }
        }

        PricingPlanDto newPlan = null;
        String trialExpiresAtStr = null;

        if (pricingPlanId != null) {
            try {
                newPlan = pricingPlanService.getPricingPlanById(pricingPlanId);

                boolean isOldPlanTrial = oldPlan != null && oldPlan.getTrialPeriodDays() != null
                        && oldPlan.getTrialPeriodDays() > 0;
                boolean isOldPlanMonthly = oldPlan != null && oldPlan.getPricePerMonth() != null
                        && oldPlan.getPricePerMonth().compareTo(BigDecimal.ZERO) > 0;
                boolean isOldPlanPayPerRequest = oldPlan != null && oldPlan.getPricePerRequest() != null
                        && !isOldPlanMonthly;

                boolean isNewPlanTrial = newPlan.getTrialPeriodDays() != null && newPlan.getTrialPeriodDays() > 0;
                boolean isNewPlanMonthly = newPlan.getPricePerMonth() != null
                        && newPlan.getPricePerMonth().compareTo(BigDecimal.ZERO) > 0;
                boolean isNewPlanPayPerRequest = newPlan.getPricePerRequest() != null && !isNewPlanMonthly;

                // CAS 1 : Plan Essai gratuit
                if (isOldPlanTrial || isNewPlanTrial) {
                    if (isNewPlanTrial && (Boolean.TRUE.equals(organization.getTrialPermanentlyExpired())
                            || organization.getTrialExpiresAt() != null)) {
                        throw new IllegalArgumentException(
                                "Contacter l'administrateur par mail ou Whatsapp pour demander une prolongation.");
                    }
                    applyPlanChangeImmediately(organization, newPlan);
                    if (isNewPlanTrial) {
                        organization.setTrialExpiresAt(LocalDateTime.now().plusDays(newPlan.getTrialPeriodDays()));
                        trialExpiresAtStr = organization.getTrialExpiresAt().toString();
                    } else {
                        organization.setTrialExpiresAt(null);
                    }
                }
                // CAS 2 : Plan mensuel → Plan mensuel
                else if (isOldPlanMonthly && isNewPlanMonthly) {
                    organization.setPendingMonthlyPlanId(pricingPlanId);
                    organization.setPendingMonthlyPlanChangeDate(organization.getMonthlyPlanEndDate());
                    log.info("Changement de plan mensuel enregistré en attente pour l'organisation {}: prendra effet le {}",
                            organizationId, organization.getMonthlyPlanEndDate());
                }
                // CAS 3 : Plan mensuel → Pay-per-Request
                else if (isOldPlanMonthly && isNewPlanPayPerRequest) {
                    QuotaCheckResult quotaCheck = quotaService.checkQuotaWithResult(organizationId);
                    boolean isQuotaExceeded = !quotaCheck.isQuotaOk();

                    if (isQuotaExceeded) {
                        log.info("Changement vers Pay-per-Request appliqué immédiatement (quota dépassé) pour l'organisation {}",
                                organizationId);
                        if (organization.getMonthlyPlanStartDate() != null
                                && organization.getMonthlyPlanEndDate() != null) {
                            generateMonthlyPlanClosureInvoice(organizationId, oldPlan,
                                    organization.getMonthlyPlanStartDate(), organization.getMonthlyPlanEndDate());
                        }
                        applyPlanChangeImmediately(organization, newPlan);
                        organization.setPendingPayPerRequestPlanId(null);
                        organization.setPendingPayPerRequestChangeDate(null);
                    } else {
                        organization.setPendingPayPerRequestPlanId(pricingPlanId);
                        organization.setPendingPayPerRequestChangeDate(organization.getMonthlyPlanEndDate());
                        log.info("Changement vers Pay-per-Request enregistré en attente pour l'organisation {}",
                                organizationId);
                    }
                }
                // CAS 4 : Pay-per-Request → Plan mensuel
                else if (isOldPlanPayPerRequest && isNewPlanMonthly) {
                    generatePayPerRequestClosureInvoice(organizationId, organization, oldPlan);
                    applyPlanChangeImmediately(organization, newPlan);
                    initializeMonthlyPlanCycle(organization, newPlan);
                }
                // CAS 5 : Pay-per-Request → Pay-per-Request
                else if (isOldPlanPayPerRequest && isNewPlanPayPerRequest) {
                    applyPlanChangeImmediately(organization, newPlan);
                }
                // CAS 6 : Pas de plan → Nouveau plan
                else if (oldPlan == null) {
                    applyPlanChangeImmediately(organization, newPlan);
                    if (isNewPlanTrial) {
                        organization.setTrialExpiresAt(LocalDateTime.now().plusDays(newPlan.getTrialPeriodDays()));
                        trialExpiresAtStr = organization.getTrialExpiresAt().toString();
                    }
                }

            } catch (IllegalArgumentException e) {
                throw e;
            } catch (Exception e) {
                throw new IllegalArgumentException("Erreur lors du changement de plan: " + e.getMessage());
            }
        } else {
            organization.setPricingPlanId(null);
            organization.setTrialExpiresAt(null);
            organization.setMonthlyPlanStartDate(null);
            organization.setMonthlyPlanEndDate(null);
            organization.setPendingMonthlyPlanId(null);
            organization.setPendingMonthlyPlanChangeDate(null);
        }

        organization = organizationRepository.save(organization);
        log.info("💾 Plan tarifaire changé pour l'organisation {} (ID: {}): planId={}, nouveau quota={}",
                organization.getName(), organizationId, pricingPlanId, organization.getMonthlyQuota());

        boolean wasTrialExpired = isTrialExpired(organization);
        if (wasTrialExpired && newPlan != null) {
            boolean isPaidPlan = (newPlan.getPricePerMonth() != null
                    && newPlan.getPricePerMonth().compareTo(BigDecimal.ZERO) > 0)
                    || (newPlan.getPricePerRequest() != null
                            && newPlan.getPricePerRequest().compareTo(BigDecimal.ZERO) > 0);
            if (isPaidPlan && canOrganizationMakeRequests(organization)) {
                log.info("Réactivation automatique des collaborateurs pour l'organisation {} (plan payant sélectionné)",
                        organization.getName());
                collaboratorService.reactivateAllCollaborators(organization);
            }
        }

        try {
            sendPricingPlanChangeNotification(organization, oldPlan, newPlan, trialExpiresAtStr);
        } catch (Exception e) {
            log.error("Erreur lors de l'envoi de l'email de notification de changement de plan pour l'organisation {}: {}",
                    organizationId, e.getMessage(), e);
        }

        return organizationMapper.toDtoWithUserCount(organization);
    }

    /**
     * Réinitialise le plan actuel (principalement pour les comptes Invités/Essai).
     */
    @Transactional
    public OrganizationDto resetPlan(Long organizationId) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(
                        () -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + organizationId));

        LocalDateTime now = LocalDateTime.now();
        LocalDate today = LocalDate.now();

        organization.setTrialExpiresAt(now.plusDays(30));
        organization.setTrialPermanentlyExpired(false);
        organization.setMonthlyPlanStartDate(today);
        organization.setMonthlyPlanEndDate(today.plusDays(30));

        int deletedLogs = usageLogRepository.deleteByOrganizationId(organizationId);
        log.info("Historique effacé pour forcer la consommation à 0 : {} logs supprimés.", deletedLogs);

        organization = organizationRepository.save(organization);
        collaboratorService.reactivateAllCollaborators(organization);

        log.info("Plan réinitialisé pour l'organisation {} (ID: {}). Nouveau cycle: {} -> {}, Expire le: {}",
                organization.getName(), organizationId,
                organization.getMonthlyPlanStartDate(), organization.getMonthlyPlanEndDate(),
                organization.getTrialExpiresAt());

        return organizationMapper.toDto(organization);
    }

    /**
     * Applique un changement de plan immédiatement.
     * Méthode publique pour permettre l'utilisation par le scheduler.
     */
    public void applyPlanChangeImmediately(Organization org, PricingPlanDto plan) {
        org.setPricingPlanId(plan.getId());
        org.setMonthlyQuota(plan.getMonthlyQuota());

        if (plan.getPricePerMonth() != null && plan.getPricePerMonth().compareTo(BigDecimal.ZERO) > 0) {
            initializeMonthlyPlanCycle(org, plan);
        } else {
            org.setMonthlyPlanStartDate(null);
            org.setMonthlyPlanEndDate(null);
        }

        org.setPendingMonthlyPlanId(null);
        org.setPendingMonthlyPlanChangeDate(null);
        org.setPendingPayPerRequestPlanId(null);
        org.setPendingPayPerRequestChangeDate(null);
    }

    /**
     * Active un plan tarifaire pour une organisation après confirmation de paiement.
     */
    @Transactional
    public void activatePlanAfterPayment(Long organizationId, Long planId) {
        Organization org = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new IllegalArgumentException("Organisation introuvable: " + organizationId));

        if (org.getPricingPlanId() != null
                && org.getMonthlyPlanStartDate() != null
                && org.getMonthlyPlanEndDate() != null) {
            try {
                PricingPlanDto oldPlan = pricingPlanService.getPricingPlanById(org.getPricingPlanId());
                if (oldPlan.getPricePerMonth() != null
                        && oldPlan.getPricePerMonth().compareTo(BigDecimal.ZERO) > 0) {
                    generateMonthlyPlanClosureInvoice(organizationId, oldPlan,
                            org.getMonthlyPlanStartDate(), org.getMonthlyPlanEndDate());
                }
            } catch (Exception e) {
                log.error("Erreur génération facture de clôture pour org {}: {}", organizationId, e.getMessage(), e);
            }
        }

        PricingPlanDto plan = pricingPlanService.getPricingPlanById(planId);
        applyPlanChangeImmediately(org, plan);
        if (plan.getPricePerMonth() != null && plan.getPricePerMonth().compareTo(BigDecimal.ZERO) > 0) {
            org.setTrialPermanentlyExpired(false);
        }
        organizationRepository.save(org);

        int deleted = usageLogRepository.deleteByOrganizationId(organizationId);
        log.info("Plan {} activé pour l'organisation {} — {} logs supprimés pour le nouveau cycle",
                planId, organizationId, deleted);

        quotaAlertRepository.deleteByOrganizationId(organizationId);
        log.info("Alertes quota supprimées pour l'organisation {} après renouvellement du plan", organizationId);
    }

    /**
     * Annule un changement de plan mensuel en attente.
     */
    @Transactional
    public OrganizationDto cancelPendingPlanChange(Long organizationId) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(
                        () -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + organizationId));

        if (organization.getPendingMonthlyPlanId() == null) {
            throw new IllegalArgumentException("Aucun changement de plan mensuel en attente pour cette organisation");
        }

        organization.setPendingMonthlyPlanId(null);
        organization.setPendingMonthlyPlanChangeDate(null);
        organization = organizationRepository.save(organization);

        log.info("Changement de plan mensuel annulé pour l'organisation {}", organizationId);
        return organizationMapper.toDto(organization);
    }

    /**
     * Annule un changement vers Pay-per-Request en attente.
     */
    @Transactional
    public OrganizationDto cancelPendingPayPerRequestChange(Long organizationId) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(
                        () -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + organizationId));

        if (organization.getPendingPayPerRequestPlanId() == null) {
            throw new IllegalArgumentException(
                    "Aucun changement vers Pay-per-Request en attente pour cette organisation");
        }

        organization.setPendingPayPerRequestPlanId(null);
        organization.setPendingPayPerRequestChangeDate(null);
        organization = organizationRepository.save(organization);

        log.info("Changement vers Pay-per-Request annulé pour l'organisation {}", organizationId);
        return organizationMapper.toDto(organization);
    }

    /**
     * Vérifie si l'essai gratuit d'une organisation est expiré.
     */
    @Transactional(readOnly = true)
    public boolean isTrialExpired(Organization organization) {
        if (organization.getTrialExpiresAt() == null) {
            return false;
        }

        if (organization.getPricingPlanId() != null) {
            try {
                PricingPlanDto plan = pricingPlanService.getPricingPlanById(organization.getPricingPlanId());
                boolean isPaidPlan = (plan.getPricePerMonth() != null
                        && plan.getPricePerMonth().compareTo(BigDecimal.ZERO) > 0)
                        || (plan.getPricePerRequest() != null
                                && plan.getPricePerRequest().compareTo(BigDecimal.ZERO) > 0);
                if (isPaidPlan) {
                    log.debug("Essai non expiré pour l'organisation {}: plan payant actif (ID: {})",
                            organization.getId(), organization.getPricingPlanId());
                    return false;
                }
            } catch (Exception e) {
                log.warn("Impossible de récupérer le plan pour vérifier l'expiration de l'essai: {}", e.getMessage());
            }
        }

        Integer monthlyQuota = organization.getMonthlyQuota();
        if (monthlyQuota != null) {
            LocalDateTime startDateTime;
            LocalDateTime endDateTime;
            if (organization.getMonthlyPlanStartDate() != null && organization.getMonthlyPlanEndDate() != null) {
                startDateTime = organization.getMonthlyPlanStartDate().atStartOfDay();
                endDateTime = organization.getMonthlyPlanEndDate().atTime(23, 59, 59, 999999999);
            } else {
                LocalDateTime now = LocalDateTime.now();
                startDateTime = now.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
                endDateTime = now.withDayOfMonth(now.toLocalDate().lengthOfMonth())
                        .withHour(23).withMinute(59).withSecond(59).withNano(999999999);
            }

            long currentUsage = organizationMapper.computeCredits(usageLogRepository.findByOrganizationIdAndTimestampBetween(
                    organization.getId(), startDateTime, endDateTime));

            if (currentUsage < monthlyQuota) {
                log.debug("Essai non expiré pour l'organisation {}: quota non atteint ({}/{})",
                        organization.getId(), currentUsage, monthlyQuota);
                return false;
            }

            if (!Boolean.TRUE.equals(organization.getTrialPermanentlyExpired())) {
                organization.setTrialPermanentlyExpired(true);
                organizationRepository.save(organization);
                log.info("Essai définitivement terminé pour l'organisation {}: quota atteint ({}/{})",
                        organization.getId(), currentUsage, monthlyQuota);
            }
            return true;
        }

        LocalDateTime now = LocalDateTime.now();
        if (organization.getTrialExpiresAt().isBefore(now)) {
            if (organization.getPricingPlanId() != null) {
                try {
                    PricingPlanDto plan = pricingPlanService.getPricingPlanById(organization.getPricingPlanId());
                    boolean isPaidPlan = (plan.getPricePerMonth() != null
                            && plan.getPricePerMonth().compareTo(BigDecimal.ZERO) > 0)
                            || (plan.getPricePerRequest() != null
                                    && plan.getPricePerRequest().compareTo(BigDecimal.ZERO) > 0);
                    return !isPaidPlan;
                } catch (Exception e) {
                    log.warn("Impossible de récupérer le plan pour vérifier l'expiration de l'essai: {}",
                            e.getMessage());
                    return true;
                }
            }
            return true;
        }

        return false;
    }

    /**
     * Vérifie si une organisation peut effectuer des requêtes.
     */
    @Transactional(readOnly = true)
    public boolean canOrganizationMakeRequests(Organization organization) {
        if (!Boolean.TRUE.equals(organization.getEnabled())) {
            log.debug("Organisation {} désactivée par un administrateur", organization.getId());
            return false;
        }

        if (isTrialExpired(organization)) {
            return false;
        }

        if (organization.getMonthlyPlanEndDate() != null
                && LocalDate.now().isAfter(organization.getMonthlyPlanEndDate())) {
            log.debug("Organisation {} bloquée : plan mensuel expiré le {}",
                    organization.getId(), organization.getMonthlyPlanEndDate());
            return false;
        }

        Integer monthlyQuota = organization.getMonthlyQuota();
        if (organization.getPricingPlanId() != null) {
            try {
                PricingPlanDto plan = pricingPlanService.getPricingPlanById(organization.getPricingPlanId());
                monthlyQuota = plan.getMonthlyQuota();
            } catch (Exception e) {
                log.warn("Impossible de récupérer le plan {} pour vérifier le quota: {}",
                        organization.getPricingPlanId(), e.getMessage());
            }
        }
        if (monthlyQuota != null) {
            LocalDateTime start;
            LocalDateTime end;
            if (organization.getMonthlyPlanStartDate() != null && organization.getMonthlyPlanEndDate() != null) {
                start = organization.getMonthlyPlanStartDate().atStartOfDay();
                end = organization.getMonthlyPlanEndDate().atTime(23, 59, 59);
            } else {
                LocalDate today = LocalDate.now();
                start = today.withDayOfMonth(1).atStartOfDay();
                end = today.withDayOfMonth(today.lengthOfMonth()).atTime(23, 59, 59);
            }
            long currentUsage = organizationMapper.computeCredits(usageLogRepository.findByOrganizationIdAndTimestampBetween(
                    organization.getId(), start, end));
            if (currentUsage >= monthlyQuota) {
                log.debug("Organisation {} bloquée : quota de crédits épuisé ({}/{})",
                        organization.getId(), currentUsage, monthlyQuota);
                return false;
            }
        }

        return true;
    }

    /**
     * Vérifie si une organisation peut effectuer des requêtes à partir de son ID.
     */
    @Transactional
    public boolean canOrganizationMakeRequests(Long organizationId) {
        Optional<Organization> organizationOpt = organizationRepository.findById(organizationId);
        if (organizationOpt.isEmpty()) {
            log.warn("Organisation {} introuvable lors de la vérification de l'essai", organizationId);
            return false;
        }
        return canOrganizationMakeRequests(organizationOpt.get());
    }

    /**
     * Vérifie et suspend automatiquement les collaborateurs si l'essai est expiré.
     */
    @Transactional
    public void checkAndSuspendIfTrialExpired(Organization organization) {
        if (isTrialExpired(organization)) {
            log.info("L'essai de l'organisation {} est expiré. Suspension des collaborateurs.", organization.getId());
            collaboratorService.suspendAllCollaborators(organization);
        }
    }

    /**
     * Récupère toutes les organisations avec un plan Pay-per-Request.
     */
    @Transactional(readOnly = true)
    public List<OrganizationDto> getOrganizationsWithPayPerRequestPlan() {
        List<Organization> organizations = organizationRepository.findAll();

        return organizations.stream()
                .filter(org -> org.getPricingPlanId() != null)
                .filter(org -> {
                    try {
                        PricingPlanDto plan = pricingPlanService.getPricingPlanById(org.getPricingPlanId());
                        return plan.getPricePerRequest() != null && plan.getMonthlyQuota() == null;
                    } catch (Exception e) {
                        log.warn("Impossible de récupérer le plan pour l'organisation {}: {}",
                                org.getId(), e.getMessage());
                        return false;
                    }
                })
                .map(organizationMapper::toDto)
                .collect(Collectors.toList());
    }

    /**
     * Initialise un nouveau cycle mensuel pour une organisation.
     */
    public void initializeMonthlyPlanCycle(Organization org, PricingPlanDto plan) {
        LocalDate today = LocalDate.now();
        org.setMonthlyPlanStartDate(today);
        LocalDate endDate = today.plusMonths(1).minusDays(1);
        org.setMonthlyPlanEndDate(endDate);
        org.setMonthlyQuota(plan.getMonthlyQuota());
        log.info("Cycle mensuel initialisé pour l'organisation {}: du {} au {} (inclus)",
                org.getId(), today, endDate);
    }

    /**
     * Génère une facture de clôture pour un plan mensuel.
     */
    public void generateMonthlyPlanClosureInvoice(Long organizationId, PricingPlanDto plan,
            LocalDate startDate, LocalDate endDate) {
        try {
            invoiceService.generateMonthlyPlanCycleClosureInvoice(organizationId, plan, startDate, endDate);
        } catch (Exception e) {
            log.error("Erreur lors de la génération de la facture de clôture mensuelle pour l'organisation {}: {}",
                    organizationId, e.getMessage(), e);
        }
    }

    /**
     * Génère une facture de clôture pour un plan pay-per-request.
     */
    private void generatePayPerRequestClosureInvoice(Long organizationId, Organization org, PricingPlanDto plan) {
        try {
            LocalDate startDate = org.getLastPayPerRequestInvoiceDate() != null
                    ? org.getLastPayPerRequestInvoiceDate()
                    : org.getCreatedAt().toLocalDate();
            LocalDate endDate = LocalDate.now();
            invoiceService.generatePayPerRequestClosureInvoice(organizationId, plan, startDate, endDate);
            org.setLastPayPerRequestInvoiceDate(endDate);
        } catch (Exception e) {
            log.error("Erreur lors de la génération de la facture de clôture pay-per-request pour l'organisation {}: {}",
                    organizationId, e.getMessage(), e);
        }
    }

    /**
     * Envoie un email de notification de changement de plan tarifaire.
     */
    private void sendPricingPlanChangeNotification(Organization organization, PricingPlanDto oldPlan,
            PricingPlanDto newPlan, String trialExpiresAtStr) {
        List<String> userEmails = new java.util.ArrayList<>();

        if (organization.getEmail() != null && !organization.getEmail().trim().isEmpty()) {
            userEmails.add(organization.getEmail());
        }

        try {
            List<OrganizationUser> organizationUsers = organizationUserRepository
                    .findByOrganizationId(organization.getId());
            List<String> keycloakUserIds = organizationUsers.stream()
                    .map(OrganizationUser::getKeycloakUserId)
                    .filter(id -> id != null && !id.trim().isEmpty())
                    .collect(Collectors.toList());

            // Note: getUserEmails requires KeycloakAdminService but we don't have direct access
            // The email notification uses the organization email as primary recipient
        } catch (Exception e) {
            log.warn("Erreur lors de la récupération des emails des utilisateurs: {}", e.getMessage());
        }

        String oldPlanName = oldPlan != null ? oldPlan.getName() : null;
        BigDecimal oldPlanPricePerMonth = oldPlan != null ? oldPlan.getPricePerMonth() : null;
        BigDecimal oldPlanPricePerRequest = oldPlan != null ? oldPlan.getPricePerRequest() : null;
        Integer oldPlanQuota = oldPlan != null ? oldPlan.getMonthlyQuota() : null;

        String newPlanName = newPlan != null ? newPlan.getName() : null;
        String newPlanDescription = newPlan != null ? newPlan.getDescription() : null;
        BigDecimal newPlanPricePerMonth = newPlan != null ? newPlan.getPricePerMonth() : null;
        BigDecimal newPlanPricePerRequest = newPlan != null ? newPlan.getPricePerRequest() : null;
        Integer newPlanQuota = newPlan != null ? newPlan.getMonthlyQuota() : null;
        Integer trialPeriodDays = newPlan != null ? newPlan.getTrialPeriodDays() : null;

        if (!userEmails.isEmpty()) {
            emailService.sendPricingPlanChangedEmailToMultiple(
                    userEmails,
                    organization.getName(),
                    oldPlanName,
                    oldPlanPricePerMonth,
                    oldPlanPricePerRequest,
                    oldPlanQuota,
                    newPlanName,
                    newPlanDescription,
                    newPlanPricePerMonth,
                    newPlanPricePerRequest,
                    newPlanQuota,
                    trialPeriodDays,
                    trialExpiresAtStr);
        } else {
            log.warn("Aucun email trouvé pour envoyer la notification de changement de plan à l'organisation {}",
                    organization.getId());
        }
    }
}
