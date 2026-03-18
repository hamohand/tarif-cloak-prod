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
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
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
            if (marketVersion != null && !marketVersion.isEmpty() && !marketVersion.trim().isEmpty()) {
                String trimmedVersion = marketVersion.trim();
                log.info("🔍 Utilisation de marketVersion trim: '{}'", trimmedVersion);
                
                // Filtrer par version de marché (plans standards uniquement, pas les plans personnalisés)
                plans = pricingPlanRepository.findByMarketVersionAndIsActiveTrueAndIsCustomFalseOrderByDisplayOrderAsc(trimmedVersion);
                log.info("✅ {} plan(s) trouvé(s) pour marketVersion='{}'", plans.size(), trimmedVersion);
                
                if (plans.isEmpty()) {
                    log.warn("⚠️ Aucun plan trouvé pour marketVersion='{}'. Vérifiez que les plans ont bien market_version='{}' en base de données.", trimmedVersion, trimmedVersion);
                    // Log tous les plans actifs pour déboguer
                    List<PricingPlan> allActivePlans = pricingPlanRepository.findByIsActiveTrueOrderByDisplayOrderAsc();
                    log.warn("⚠️ Plans actifs disponibles en base: {}", 
                        allActivePlans.stream()
                            .map(p -> String.format("%s (market_version='%s', is_custom=%s)", 
                                p.getName(), p.getMarketVersion(), p.getIsCustom()))
                            .collect(Collectors.joining(", ")));
                } else {
                    log.info("✅ Plans trouvés: {}", 
                        plans.stream()
                            .map(p -> String.format("%s (market_version='%s')", p.getName(), p.getMarketVersion()))
                            .collect(Collectors.joining(", ")));
                }
            } else {
                // Par défaut, récupérer tous les plans actifs (comportement existant)
                plans = pricingPlanRepository.findByIsActiveTrueOrderByDisplayOrderAsc();
                log.warn("⚠️ marketVersion non fourni ou vide - Récupération de tous les plans actifs: {}", plans.size());
            }
            return plans.stream()
                    .map(this::toDto)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Erreur lors de la récupération des plans tarifaires actifs depuis la base de données", e);
            throw e; // Re-lancer l'exception pour que le controller puisse la gérer
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
        List<PricingPlan> plans;
        
        // Récupérer les plans selon la version de marché
        if (marketVersion != null && !marketVersion.trim().isEmpty()) {
            String trimmedVersion = marketVersion.trim();
            plans = pricingPlanRepository.findByMarketVersionAndIsActiveTrueAndIsCustomFalseOrderByDisplayOrderAsc(trimmedVersion);
            log.info("🔍 Récupération des plans pour marketVersion='{}': {} plan(s) trouvé(s)", trimmedVersion, plans.size());
        } else {
            plans = pricingPlanRepository.findByIsActiveTrueOrderByDisplayOrderAsc();
            log.info("🔍 Récupération de tous les plans actifs: {} plan(s) trouvé(s)", plans.size());
        }
        
        // Si une organisation est spécifiée, vérifier si elle a déjà utilisé l'essai gratuit
        if (organizationId != null) {
            Optional<Organization> orgOpt = organizationRepository.findById(organizationId);
            if (orgOpt.isPresent()) {
                Organization org = orgOpt.get();
                
                // Vérifier si l'organisation a déjà utilisé l'essai gratuit
                // L'essai est considéré comme utilisé si :
                // 1. trialPermanentlyExpired est true, OU
                // 2. trialExpiresAt n'est pas null (même si pas encore expiré)
                boolean hasUsedTrial = Boolean.TRUE.equals(org.getTrialPermanentlyExpired()) 
                        || org.getTrialExpiresAt() != null;
                
                // Vérifier si l'organisation a actuellement un plan payant
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
                    // Exclure tous les plans d'essai (trialPeriodDays > 0) ET tous les plans gratuits
                    int plansBeforeFilter = plans.size();
                    plans = plans.stream()
                            .filter(plan -> {
                                // Exclure les plans d'essai
                                if (plan.getTrialPeriodDays() != null && plan.getTrialPeriodDays() > 0) {
                                    return false;
                                }
                                
                                // Exclure les plans gratuits (pricePerMonth = 0 ou null ET pricePerRequest = 0 ou null)
                                boolean isFreePlan = (plan.getPricePerMonth() == null || plan.getPricePerMonth().compareTo(BigDecimal.ZERO) == 0)
                                        && (plan.getPricePerRequest() == null || plan.getPricePerRequest().compareTo(BigDecimal.ZERO) == 0);
                                
                                // Ne garder que les plans payants
                                return !isFreePlan;
                            })
                            .collect(Collectors.toList());
                    
                    log.info("🚫 Plans d'essai et plans gratuits exclus pour l'organisation {} (ID: {}): {} plan(s) filtré(s), {} plan(s) payant(s) restant(s)", 
                            org.getName(), organizationId, plansBeforeFilter - plans.size(), plans.size());
                } else {
                    log.info("✅ Plans d'essai et plans gratuits disponibles pour l'organisation {} (ID: {}): l'essai n'a pas encore été utilisé", 
                            org.getName(), organizationId);
                }
            } else {
                log.warn("⚠️ Organisation {} introuvable, tous les plans seront retournés", organizationId);
            }
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
     * Récupère un plan tarifaire par son ID (seulement si actif).
     */
    @Transactional(readOnly = true)
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
        // Vérifier l'unicité du nom
        if (pricingPlanRepository.existsByName(request.getName())) {
            throw new IllegalArgumentException("Un plan tarifaire avec ce nom existe déjà: " + request.getName());
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
        plan.setMarketVersion(request.getMarketVersion() != null ? request.getMarketVersion() : "DEFAULT");
        plan.setCurrency(request.getCurrency() != null ? request.getCurrency() : "EUR");
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
        
        // Vérifier si le nom existe déjà (pour un autre plan)
        if (request.getName() != null && !request.getName().equals(plan.getName())) {
            if (pricingPlanRepository.existsByName(request.getName())) {
                throw new IllegalArgumentException("Un plan tarifaire avec ce nom existe déjà: " + request.getName());
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
            plan.setMarketVersion(request.getMarketVersion());
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

