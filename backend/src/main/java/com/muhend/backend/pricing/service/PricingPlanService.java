package com.muhend.backend.pricing.service;

import com.muhend.backend.pricing.dto.PricingPlanDto;
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
     */
    @Transactional(readOnly = true)
    public List<PricingPlanDto> getActivePricingPlans() {
        List<PricingPlan> plans = pricingPlanRepository.findByIsActiveTrueOrderByDisplayOrderAsc();
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
     * Convertit un PricingPlan en DTO.
     */
    private PricingPlanDto toDto(PricingPlan plan) {
        PricingPlanDto dto = new PricingPlanDto();
        dto.setId(plan.getId());
        dto.setName(plan.getName());
        dto.setDescription(plan.getDescription());
        dto.setPricePerMonth(plan.getPricePerMonth());
        dto.setMonthlyQuota(plan.getMonthlyQuota());
        dto.setFeatures(plan.getFeatures());
        dto.setIsActive(plan.getIsActive());
        dto.setDisplayOrder(plan.getDisplayOrder());
        return dto;
    }
}

