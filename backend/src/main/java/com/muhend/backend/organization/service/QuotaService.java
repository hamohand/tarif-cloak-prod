package com.muhend.backend.organization.service;

import com.muhend.backend.organization.dto.OrganizationDto;
import com.muhend.backend.organization.dto.OrganizationMapper;
import com.muhend.backend.organization.dto.QuotaCheckResult;
import com.muhend.backend.organization.exception.QuotaExceededException;
import com.muhend.backend.organization.model.Organization;
import com.muhend.backend.organization.repository.OrganizationRepository;
import com.muhend.backend.pricing.dto.PricingPlanDto;
import com.muhend.backend.pricing.service.PricingPlanService;
import com.muhend.backend.usage.model.UsageLog;
import com.muhend.backend.usage.repository.UsageLogRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Service pour la vérification des quotas et le calcul des crédits consommés.
 */
@Service
@Slf4j
public class QuotaService {

    private final OrganizationRepository organizationRepository;
    private final UsageLogRepository usageLogRepository;
    private final PricingPlanService pricingPlanService;
    private final OrganizationMapper organizationMapper;

    @Value("${credits.positions10:15}")
    private int creditsPositions10;
    @Value("${credits.positions6:10}")
    private int creditsPositions6;
    @Value("${credits.decode-p10:5}")
    private int creditsDecodep10;
    @Value("${credits.decode:2}")
    private int creditsDecode;
    @Value("${credits.default:1}")
    private int creditsDefault;

    public QuotaService(OrganizationRepository organizationRepository,
                        UsageLogRepository usageLogRepository,
                        PricingPlanService pricingPlanService,
                        OrganizationMapper organizationMapper) {
        this.organizationRepository = organizationRepository;
        this.usageLogRepository = usageLogRepository;
        this.pricingPlanService = pricingPlanService;
        this.organizationMapper = organizationMapper;
    }

    /**
     * Calcule la somme de crédits consommés à partir d'une liste de logs d'utilisation.
     */
    private long computeCredits(List<UsageLog> logs) {
        return organizationMapper.computeCredits(logs);
    }

    /** Somme des crédits consommés par une organisation sur une période. */
    public long computeOrganizationCredits(Long organizationId, LocalDateTime start, LocalDateTime end) {
        return computeCredits(usageLogRepository.findByOrganizationIdAndTimestampBetween(organizationId, start, end));
    }

    /** Somme des crédits consommés par un utilisateur sur une période. */
    public long computeUserCredits(String keycloakUserId, LocalDateTime start, LocalDateTime end) {
        return computeCredits(usageLogRepository.findByKeycloakUserIdAndTimestampBetween(keycloakUserId, start, end));
    }

    /**
     * Vérifie si le quota mensuel d'une organisation est dépassé.
     * @deprecated Utiliser checkQuotaWithResult() à la place
     */
    @Deprecated
    public boolean checkQuota(Long organizationId) {
        if (organizationId == null) {
            throw new IllegalArgumentException(
                    "Un utilisateur doit être associé à une organisation. organizationId ne peut pas être null.");
        }

        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(
                        () -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + organizationId));

        Integer monthlyQuota = organization.getMonthlyQuota();
        Long pricingPlanId = organization.getPricingPlanId();

        log.debug("Vérification du quota pour l'organisation {} (ID: {}): quota={}, planId={}",
                organization.getName(), organizationId, monthlyQuota, pricingPlanId);

        // Vérifier si le plan est pay-per-request
        if (pricingPlanId != null) {
            try {
                PricingPlanDto plan = pricingPlanService.getPricingPlanById(pricingPlanId);
                boolean hasPricePerRequest = plan.getPricePerRequest() != null
                        && plan.getPricePerRequest().compareTo(BigDecimal.ZERO) > 0;
                boolean hasPricePerMonth = plan.getPricePerMonth() != null
                        && plan.getPricePerMonth().compareTo(BigDecimal.ZERO) > 0;
                boolean isPayPerRequest = hasPricePerRequest && !hasPricePerMonth;

                if (isPayPerRequest) {
                    log.info("✅ Quota illimité pour l'organisation {} (ID: {}): plan pay-per-request détecté",
                            organization.getName(), organizationId);
                    if (monthlyQuota != null) {
                        log.warn("⚠️ Correction du quota pour l'organisation {} (ID: {}): {} -> null (plan pay-per-request)",
                                organization.getName(), organizationId, monthlyQuota);
                        organization.setMonthlyQuota(null);
                        organizationRepository.save(organization);
                        organizationRepository.flush();
                    }
                    return true;
                }
            } catch (Exception e) {
                log.warn("Impossible de récupérer le plan {} pour vérifier le type de plan: {}", pricingPlanId,
                        e.getMessage());
            }
        }

        if (monthlyQuota == null) {
            log.debug("Quota illimité pour l'organisation {} (plan pay-per-request ou illimité)",
                    organization.getName());
            return true;
        }

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

        long currentUsage = computeCredits(usageLogRepository.findByOrganizationIdAndTimestampBetween(
                organizationId, startDateTime, endDateTime));

        log.info("🔍 Vérification du quota pour l'organisation {} (ID: {}): crédits utilisés={}, quota={}, planId={}, période: {} à {}",
                organization.getName(), organizationId, currentUsage, monthlyQuota, pricingPlanId, startDateTime, endDateTime);

        if (currentUsage >= monthlyQuota) {
            String message = String.format(
                    "Quota mensuel dépassé pour l'organisation '%s' (ID: %d). Utilisation: %d/%d requêtes (planId: %s)",
                    organization.getName(), organizationId, currentUsage, monthlyQuota, pricingPlanId);
            log.warn("❌ {}", message);
            throw new QuotaExceededException(message);
        }

        log.info("✅ Quota OK pour l'organisation {} (ID: {}): {}/{} requêtes utilisées ce mois (planId: {})",
                organization.getName(), organizationId, currentUsage, monthlyQuota, pricingPlanId);
        return true;
    }

    /**
     * Vérifie si le quota mensuel d'une organisation est dépassé et retourne un résultat détaillé.
     */
    @Transactional(readOnly = true)
    public QuotaCheckResult checkQuotaWithResult(Long organizationId) {
        if (organizationId == null) {
            throw new IllegalArgumentException(
                    "Un utilisateur doit être associé à une organisation. organizationId ne peut pas être null.");
        }

        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(
                        () -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + organizationId));

        Integer monthlyQuota = organization.getMonthlyQuota();
        Long pricingPlanId = organization.getPricingPlanId();
        String marketVersion = organization.getMarketVersion();

        log.debug("Vérification du quota avec résultat pour l'organisation {} (ID: {}): quota={}, planId={}, marketVersion={}",
                organization.getName(), organizationId, monthlyQuota, pricingPlanId, marketVersion);

        // Vérifier si le plan actuel est pay-per-request
        if (pricingPlanId != null) {
            try {
                PricingPlanDto plan = pricingPlanService.getPricingPlanById(pricingPlanId);
                boolean hasPricePerRequest = plan.getPricePerRequest() != null
                        && plan.getPricePerRequest().compareTo(BigDecimal.ZERO) > 0;
                boolean hasPricePerMonth = plan.getPricePerMonth() != null
                        && plan.getPricePerMonth().compareTo(BigDecimal.ZERO) > 0;
                boolean isPayPerRequest = hasPricePerRequest && !hasPricePerMonth;

                if (isPayPerRequest) {
                    log.info("✅ Quota illimité pour l'organisation {} (ID: {}): plan pay-per-request",
                            organization.getName(), organizationId);
                    return new QuotaCheckResult(true, false, null, 0, null);
                }
            } catch (Exception e) {
                log.warn("Impossible de récupérer le plan {} pour vérifier le type de plan: {}", pricingPlanId,
                        e.getMessage());
            }
        }

        if (monthlyQuota == null) {
            log.debug("Quota illimité pour l'organisation {} (plan pay-per-request ou illimité)",
                    organization.getName());
            return new QuotaCheckResult(true, false, null, 0, null);
        }

        LocalDateTime startDateTime;
        LocalDateTime endDateTime;

        if (organization.getMonthlyPlanStartDate() != null && organization.getMonthlyPlanEndDate() != null) {
            LocalDate startDate = organization.getMonthlyPlanStartDate();
            LocalDate endDate = organization.getMonthlyPlanEndDate();
            startDateTime = startDate.atStartOfDay();
            endDateTime = endDate.atTime(23, 59, 59, 999999999);
            log.debug("Utilisation du cycle mensuel pour l'organisation {}: du {} au {} (inclus)",
                    organizationId, startDate, endDate);
        } else {
            LocalDateTime now = LocalDateTime.now();
            startDateTime = now.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
            endDateTime = now.withDayOfMonth(now.toLocalDate().lengthOfMonth())
                    .withHour(23).withMinute(59).withSecond(59).withNano(999999999);
            log.debug("Utilisation du mois calendaire pour l'organisation {}", organizationId);
        }

        long currentUsage = computeCredits(usageLogRepository.findByOrganizationIdAndTimestampBetween(
                organizationId, startDateTime, endDateTime));

        log.info("🔍 Vérification du quota pour l'organisation {} (ID: {}): crédits utilisés={}, quota={}, planId={}",
                organization.getName(), organizationId, currentUsage, monthlyQuota, pricingPlanId);

        if (currentUsage >= monthlyQuota) {
            BigDecimal payPerRequestPrice = null;
            try {
                List<PricingPlanDto> plans = pricingPlanService.getActivePricingPlans(marketVersion);
                Optional<PricingPlanDto> payPerRequestPlan = plans.stream()
                        .filter(p -> {
                            boolean hasPricePerRequest = p.getPricePerRequest() != null
                                    && p.getPricePerRequest().compareTo(BigDecimal.ZERO) > 0;
                            boolean hasPricePerMonth = p.getPricePerMonth() != null
                                    && p.getPricePerMonth().compareTo(BigDecimal.ZERO) > 0;
                            return hasPricePerRequest && !hasPricePerMonth;
                        })
                        .findFirst();

                if (payPerRequestPlan.isPresent()) {
                    payPerRequestPrice = payPerRequestPlan.get().getPricePerRequest();
                    log.info("💰 Plan Pay-per-Request trouvé pour le marché {}: prix={}",
                            marketVersion, payPerRequestPrice);
                }
            } catch (Exception e) {
                log.warn("Erreur lors de la recherche du plan Pay-per-Request pour le marché {}: {}", marketVersion,
                        e.getMessage());
            }

            log.info("⚠️ Quota dépassé pour l'organisation {} (ID: {}): {}/{} requêtes",
                    organization.getName(), organizationId, currentUsage, monthlyQuota);

            return new QuotaCheckResult(false, true, payPerRequestPrice, currentUsage, monthlyQuota);
        }

        log.info("✅ Quota OK pour l'organisation {} (ID: {}): {}/{} requêtes utilisées ce mois",
                organization.getName(), organizationId, currentUsage, monthlyQuota);
        return new QuotaCheckResult(true, false, null, currentUsage, monthlyQuota);
    }

    /**
     * Met à jour le quota mensuel d'une organisation.
     */
    @Transactional
    public OrganizationDto updateMonthlyQuota(Long organizationId, Integer monthlyQuota) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(
                        () -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + organizationId));

        organization.setMonthlyQuota(monthlyQuota);
        organization = organizationRepository.save(organization);

        log.info("Quota mensuel mis à jour pour l'organisation {} (ID: {}): {} requêtes/mois",
                organization.getName(), organizationId, monthlyQuota != null ? monthlyQuota : "illimité");

        return organizationMapper.toDto(organization);
    }
}
