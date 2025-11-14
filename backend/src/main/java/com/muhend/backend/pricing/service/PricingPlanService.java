package com.muhend.backend.pricing.service;

import com.muhend.backend.pricing.dto.PricingPlanDto;
import com.muhend.backend.pricing.dto.UpdatePricingPlanRequest;
import com.muhend.backend.pricing.model.PricingPlan;
import com.muhend.backend.pricing.repository.PricingPlanRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Service pour gérer les plans tarifaires.
 */
@Service
@Slf4j
public class PricingPlanService {
    
    private final PricingPlanRepository pricingPlanRepository;
    
    public PricingPlanService(PricingPlanRepository pricingPlanRepository) {
        this.pricingPlanRepository = pricingPlanRepository;
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
                // Filtrer par version de marché (plans standards uniquement, pas les plans personnalisés)
                plans = pricingPlanRepository.findByMarketVersionAndIsActiveTrueAndIsCustomFalseOrderByDisplayOrderAsc(marketVersion.trim());
                log.info("✅ {} plan(s) trouvé(s) pour marketVersion='{}'", plans.size(), marketVersion);
                if (plans.isEmpty()) {
                    log.warn("⚠️ Aucun plan trouvé pour marketVersion='{}'. Vérifiez que les plans ont bien market_version='{}' en base de données.", marketVersion, marketVersion);
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

