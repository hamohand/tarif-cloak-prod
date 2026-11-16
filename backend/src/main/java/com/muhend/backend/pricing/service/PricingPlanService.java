package com.muhend.backend.pricing.service;

import com.muhend.backend.organization.model.Organization;
import com.muhend.backend.organization.repository.OrganizationRepository;
import com.muhend.backend.pricing.dto.CreatePricingPlanRequest;
import com.muhend.backend.pricing.dto.PricingPlanDto;
import com.muhend.backend.pricing.dto.UpdatePricingPlanRequest;
import com.muhend.backend.pricing.model.PricingPlan;
import com.muhend.backend.pricing.repository.PricingPlanRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service pour gérer les plans tarifaires.
 */
@Service
@Slf4j
public class PricingPlanService {
    
    private final PricingPlanRepository pricingPlanRepository;
    private final OrganizationRepository organizationRepository;
    
    public PricingPlanService(PricingPlanRepository pricingPlanRepository,
                             OrganizationRepository organizationRepository) {
        this.pricingPlanRepository = pricingPlanRepository;
        this.organizationRepository = organizationRepository;
    }
    
    /**
     * Récupère tous les plans tarifaires actifs, triés par ordre d'affichage.
     * Si marketVersion est fourni, filtre par version de marché.
     */
    @Transactional(readOnly = true)
    public List<PricingPlanDto> getActivePricingPlans(String marketVersion) {
        try {
            List<PricingPlan> plans;
            log.info("🔍 Récupération des plans tarifaires - marketVersion reçu: '{}'", marketVersion);
            if (marketVersion != null && !marketVersion.trim().isEmpty()) {
                String trimmedVersion = marketVersion.trim().toUpperCase(Locale.ROOT);
                plans = pricingPlanRepository.findByMarketVersionAndIsActiveTrueAndIsCustomFalseOrderByDisplayOrderAsc(trimmedVersion);
                if (plans.isEmpty() && !"DEFAULT".equals(trimmedVersion)) {
                    log.warn("⚠️ Aucun plan actif pour marketVersion='{}', repli sur 'DEFAULT'", trimmedVersion);
                    plans = pricingPlanRepository.findByMarketVersionAndIsActiveTrueAndIsCustomFalseOrderByDisplayOrderAsc("DEFAULT");
                }
                log.info("✅ {} plan(s) trouvé(s) pour marketVersion='{}'", plans.size(), trimmedVersion);
            } else {
                plans = pricingPlanRepository.findByIsActiveTrueOrderByDisplayOrderAsc();
                log.info("📋 Récupération de tous les plans actifs: {}", plans.size());
            }
            return plans.stream()
                    .map(this::toDto)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Erreur lors de la récupération des plans tarifaires actifs depuis la base de données", e);
            throw e;
        }
    }
    
    /**
     * Récupère les plans personnalisés d'une organisation.
     */
    @Transactional(readOnly = true)
    public List<PricingPlanDto> getCustomPricingPlansForOrganization(Long organizationId) {
        List<PricingPlan> plans = pricingPlanRepository.findByOrganizationIdAndIsActiveTrueOrderByDisplayOrderAsc(organizationId);
        return plans.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Récupère les plans tarifaires disponibles pour une organisation.
     * Exclut automatiquement le plan d'essai gratuit si l'organisation l'a déjà utilisé.
     * 
     * @param marketVersion Version de marché (ex: 'DZ', 'DEFAULT')
     * @param organizationId ID de l'organisation (optionnel)
     * @return Liste des plans tarifaires disponibles pour l'organisation
     */
    @Transactional(readOnly = true)
    public List<PricingPlanDto> getAvailablePricingPlansForOrganization(String marketVersion, Long organizationId) {
        Optional<Organization> orgOpt = organizationId != null
                ? organizationRepository.findById(organizationId)
                : Optional.empty();

        String effectiveMarket = (marketVersion != null && !marketVersion.trim().isEmpty())
                ? marketVersion.trim().toUpperCase(Locale.ROOT)
                : orgOpt.map(Organization::getMarketVersion)
                        .filter(m -> m != null && !m.isBlank())
                        .map(m -> m.trim().toUpperCase(Locale.ROOT))
                        .orElse(null);

        List<PricingPlan> plans;
        if (effectiveMarket != null) {
            plans = pricingPlanRepository.findByMarketVersionAndIsActiveTrueAndIsCustomFalseOrderByDisplayOrderAsc(effectiveMarket);
            if (plans.isEmpty() && !"DEFAULT".equals(effectiveMarket)) {
                plans = pricingPlanRepository.findByMarketVersionAndIsActiveTrueAndIsCustomFalseOrderByDisplayOrderAsc("DEFAULT");
            }
            log.info("🔍 Récupération des plans pour marketVersion='{}': {} plan(s)", effectiveMarket, plans.size());
        } else {
            plans = pricingPlanRepository.findByIsActiveTrueOrderByDisplayOrderAsc();
            log.info("🔍 Récupération de tous les plans actifs: {} plan(s)", plans.size());
        }

        if (orgOpt.isPresent()) {
            Organization org = orgOpt.get();
            boolean hasUsedTrial = Boolean.TRUE.equals(org.getTrialPermanentlyExpired())
                    || org.getTrialExpiresAt() != null;

            boolean hasPaidPlan = false;
            if (org.getPricingPlanId() != null) {
                try {
                    PricingPlanDto currentPlan = getPricingPlanById(org.getPricingPlanId());
                    boolean hasPricePerMonth = currentPlan.getPricePerMonth() != null && currentPlan.getPricePerMonth().compareTo(BigDecimal.ZERO) > 0;
                    boolean hasPricePerRequest = currentPlan.getPricePerRequest() != null && currentPlan.getPricePerRequest().compareTo(BigDecimal.ZERO) > 0;
                    hasPaidPlan = hasPricePerMonth || hasPricePerRequest;
                } catch (Exception e) {
                    log.warn("Impossible de récupérer le plan actuel pour vérifier s'il s'agit d'un plan payant: {}", e.getMessage());
                }
            }

            if (hasUsedTrial || hasPaidPlan) {
                int plansBeforeFilter = plans.size();
                plans = plans.stream()
                        .filter(plan -> {
                            if (plan.getTrialPeriodDays() != null && plan.getTrialPeriodDays() > 0) {
                                return false;
                            }
                            boolean isFreePlan = (plan.getPricePerMonth() == null || plan.getPricePerMonth().compareTo(BigDecimal.ZERO) == 0)
                                    && (plan.getPricePerRequest() == null || plan.getPricePerRequest().compareTo(BigDecimal.ZERO) == 0);
                            return !isFreePlan;
                        })
                        .collect(Collectors.toList());

                log.info("🚫 Plans d'essai et gratuits exclus pour {} (ID: {}): {} filtré(s), {} restant(s)",
                        org.getName(), organizationId, plansBeforeFilter - plans.size(), plans.size());
            }
        } else if (organizationId != null) {
            log.warn("⚠️ Organisation {} introuvable, tous les plans seront retournés", organizationId);
        }

        return plans.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Récupère tous les plans tarifaires (actifs et inactifs), triés par ordre d'affichage.
     */
    @Transactional(readOnly = true)
    public List<PricingPlanDto> getAllPricingPlans() {
        List<PricingPlan> plans = pricingPlanRepository.findAllByOrderByDisplayOrderAsc();
        return plans.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Récupère un plan tarifaire par son nom (actif uniquement).
     */
    @Transactional(readOnly = true)
    public Optional<PricingPlanDto> findByName(String name) {
        return pricingPlanRepository.findFirstByNameAndIsActiveTrueOrderByIdAsc(name)
                .map(this::toDto);
    }

    @Transactional(readOnly = true)
    public Optional<PricingPlanDto> findByNameAndMarket(String name, String marketVersion) {
        if (marketVersion != null && !marketVersion.isBlank()) {
            Optional<PricingPlan> exact = pricingPlanRepository
                    .findFirstByNameAndMarketVersionAndIsActiveTrueOrderByIdAsc(name, marketVersion.trim().toUpperCase(Locale.ROOT));
            if (exact.isPresent()) {
                return exact.map(this::toDto);
            }
        }
        return pricingPlanRepository.findFirstByNameAndIsActiveTrueOrderByIdAsc(name)
                .map(this::toDto);
    }

    /**
     * Récupère un plan tarifaire par son ID (seulement si actif).
     */
    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public PricingPlanDto getPricingPlanById(Long id) {
        return pricingPlanRepository.findByIdAndIsActiveTrue(id)
                .map(this::toDto)
                .orElseThrow(() -> new IllegalArgumentException("Plan tarifaire introuvable ou inactif: " + id));
    }
    
    /**
     * Récupère un plan tarifaire par son ID (actif ou inactif).
     * Utilisé pour les opérations de mise à jour.
     */
    @Transactional(readOnly = true)
    public PricingPlanDto getPricingPlanByIdForUpdate(Long id) {
        return pricingPlanRepository.findById(id)
                .map(this::toDto)
                .orElseThrow(() -> new IllegalArgumentException("Plan tarifaire introuvable: " + id));
    }
    
    /**
     * Crée un nouveau plan tarifaire.
     */
    @Transactional
    public PricingPlanDto createPricingPlan(CreatePricingPlanRequest request) {
        String targetMarket = request.getMarketVersion() != null && !request.getMarketVersion().isBlank()
                ? request.getMarketVersion().trim().toUpperCase(Locale.ROOT)
                : "DEFAULT";
        if (pricingPlanRepository.existsByNameAndMarketVersion(request.getName(), targetMarket)) {
            throw new IllegalArgumentException("Un plan tarifaire avec ce nom existe déjà sur le marché " + targetMarket + ": " + request.getName());
        }

        PricingPlan plan = new PricingPlan();
        plan.setName(request.getName());
        plan.setDescription(request.getDescription());
        plan.setPricePerMonth(request.getPricePerMonth());
        plan.setPricePerRequest(request.getPricePerRequest());
        plan.setPricePerYear(request.getPricePerYear());
        plan.setMonthlyQuota(request.getMonthlyQuota());
        plan.setTrialPeriodDays(request.getTrialPeriodDays());
        plan.setFeatures(request.getFeatures());
        plan.setIsActive(request.getIsActive() != null ? request.getIsActive() : true);
        plan.setDisplayOrder(request.getDisplayOrder());
        plan.setMarketVersion(targetMarket);
        plan.setCurrency(request.getCurrency() != null ? request.getCurrency() : ("DZ".equals(targetMarket) ? "DZD" : "EUR"));
        plan.setIsCustom(request.getIsCustom() != null ? request.getIsCustom() : false);
        // Traiter organizationId = 0 comme null (pas d'organisation associée)
        Long orgId = request.getOrganizationId();
        plan.setOrganizationId(orgId != null && orgId > 0 ? orgId : null);

        PricingPlan savedPlan = pricingPlanRepository.save(plan);
        log.info("Plan tarifaire créé: id={}, name={}, marketVersion={}", savedPlan.getId(), savedPlan.getName(), savedPlan.getMarketVersion());

        return toDto(savedPlan);
    }

    /**
     * Récupère tous les plans tarifaires (actifs et inactifs) pour une version de marché donnée.
     */
    @Transactional(readOnly = true)
    public List<PricingPlanDto> getPlansByMarketVersion(String marketVersion) {
        List<PricingPlan> plans = pricingPlanRepository.findByMarketVersionAndIsActiveTrueAndIsCustomFalseOrderByDisplayOrderAsc(marketVersion);
        log.info("Récupération des plans pour marketVersion='{}': {} plan(s)", marketVersion, plans.size());
        return plans.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /**
     * Met à jour un plan tarifaire.
     */
    @Transactional
    public PricingPlanDto updatePricingPlan(Long id, UpdatePricingPlanRequest request) {
        PricingPlan plan = pricingPlanRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Plan tarifaire introuvable: " + id));
        
        String currentMarket = plan.getMarketVersion() != null ? plan.getMarketVersion() : "DEFAULT";
        String targetMarket = request.getMarketVersion() != null && !request.getMarketVersion().isBlank()
                ? request.getMarketVersion().trim().toUpperCase(Locale.ROOT)
                : currentMarket;
        String targetName = request.getName() != null ? request.getName() : plan.getName();
        if (!targetName.equals(plan.getName()) || !targetMarket.equals(currentMarket)) {
            if (pricingPlanRepository.existsByNameAndMarketVersion(targetName, targetMarket)) {
                throw new IllegalArgumentException("Un plan tarifaire avec ce nom existe déjà sur le marché " + targetMarket + ": " + targetName);
            }
        }
        
        // Mettre à jour les champs non nuls
        if (request.getName() != null) {
            plan.setName(request.getName());
        }
        if (request.getDescription() != null) {
            plan.setDescription(request.getDescription());
        }
        if (request.getPricePerMonth() != null) {
            plan.setPricePerMonth(request.getPricePerMonth());
        }
        if (request.getPricePerRequest() != null) {
            plan.setPricePerRequest(request.getPricePerRequest());
        }
        if (request.getPricePerYear() != null) {
            plan.setPricePerYear(request.getPricePerYear());
        }
        if (request.getMonthlyQuota() != null) {
            plan.setMonthlyQuota(request.getMonthlyQuota());
        }
        if (request.getTrialPeriodDays() != null) {
            plan.setTrialPeriodDays(request.getTrialPeriodDays());
        }
        if (request.getFeatures() != null) {
            plan.setFeatures(request.getFeatures());
        }
        if (request.getIsActive() != null) {
            plan.setIsActive(request.getIsActive());
        }
        if (request.getDisplayOrder() != null) {
            plan.setDisplayOrder(request.getDisplayOrder());
        }
        if (request.getMarketVersion() != null) {
            plan.setMarketVersion(targetMarket);
        }
        if (request.getCurrency() != null) {
            plan.setCurrency(request.getCurrency());
        }
        if (request.getIsCustom() != null) {
            plan.setIsCustom(request.getIsCustom());
        }
        if (request.getOrganizationId() != null) {
            plan.setOrganizationId(request.getOrganizationId() > 0 ? request.getOrganizationId() : null);
        }

        // Les champs updatedAt sont mis à jour automatiquement par @PreUpdate
        PricingPlan updatedPlan = pricingPlanRepository.save(plan);
        log.info("Plan tarifaire mis à jour: id={}, name={}", updatedPlan.getId(), updatedPlan.getName());
        
        return toDto(updatedPlan);
    }
    
    /**
     * Convertit un PricingPlan en DTO.
     */
    private PricingPlanDto toDto(PricingPlan plan) {
        PricingPlanDto dto = new PricingPlanDto();
        dto.setId(plan.getId());
        dto.setName(plan.getName());
        dto.setDescription(plan.getDescription());
        dto.setPricePerMonth(plan.getPricePerMonth());
        dto.setPricePerRequest(plan.getPricePerRequest());
        dto.setPricePerYear(plan.getPricePerYear());
        dto.setMonthlyQuota(plan.getMonthlyQuota());
        dto.setTrialPeriodDays(plan.getTrialPeriodDays());
        dto.setFeatures(plan.getFeatures());
        dto.setIsActive(plan.getIsActive());
        dto.setDisplayOrder(plan.getDisplayOrder());
        dto.setMarketVersion(plan.getMarketVersion());
        dto.setCurrency(plan.getCurrency());
        dto.setIsCustom(plan.getIsCustom());
        dto.setOrganizationId(plan.getOrganizationId());
        return dto;
    }
}

