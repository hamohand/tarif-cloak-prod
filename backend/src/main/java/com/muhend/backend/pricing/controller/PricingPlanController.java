package com.muhend.backend.pricing.controller;

import com.muhend.backend.pricing.dto.PricingPlanDto;
import com.muhend.backend.pricing.dto.UpdatePricingPlanRequest;
import com.muhend.backend.pricing.service.PricingPlanService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Controller pour gérer les plans tarifaires.
 */
@RestController
@RequestMapping("/pricing-plans")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Pricing Plans", description = "Endpoints pour consulter et gérer les plans tarifaires")
public class PricingPlanController {
    
    private final PricingPlanService pricingPlanService;
    
    @GetMapping
    @Operation(
        summary = "Récupérer tous les plans tarifaires actifs",
        description = "Retourne la liste de tous les plans tarifaires actifs, triés par ordre d'affichage. " +
                     "Si marketVersion est fourni, filtre par version de marché. " +
                     "Accessible publiquement pour permettre aux utilisateurs de consulter les plans avant l'inscription."
    )
    public ResponseEntity<List<PricingPlanDto>> getActivePricingPlans(
            @RequestParam(required = false) String marketVersion) {
        try {
            List<PricingPlanDto> plans = pricingPlanService.getActivePricingPlans(marketVersion);
            return ResponseEntity.ok(plans);
        } catch (Exception e) {
            log.error("Erreur lors de la récupération des plans tarifaires actifs", e);
            // Retourner une liste vide plutôt que de faire échouer la requête
            // Cela permet au frontend de continuer à fonctionner même si la base de données a un problème
            return ResponseEntity.ok(List.of());
        }
    }
    
    @GetMapping("/{id}")
    @Operation(
        summary = "Récupérer un plan tarifaire par ID",
        description = "Retourne les détails d'un plan tarifaire spécifique (seulement si actif)."
    )
    public ResponseEntity<PricingPlanDto> getPricingPlanById(@PathVariable Long id) {
        PricingPlanDto plan = pricingPlanService.getPricingPlanById(id);
        return ResponseEntity.ok(plan);
    }
    
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
        summary = "Mettre à jour un plan tarifaire",
        description = "Met à jour un plan tarifaire. Réservé aux administrateurs. " +
                     "Seuls les champs fournis dans la requête seront mis à jour (mise à jour partielle)."
    )
    public ResponseEntity<PricingPlanDto> updatePricingPlan(
            @PathVariable Long id,
            @Valid @RequestBody UpdatePricingPlanRequest request) {
        PricingPlanDto updatedPlan = pricingPlanService.updatePricingPlan(id, request);
        return ResponseEntity.ok(updatedPlan);
    }
}

