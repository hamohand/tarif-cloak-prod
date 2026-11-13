package com.muhend.backend.pricing.controller;

import com.muhend.backend.pricing.dto.CreatePricingPlanRequest;
import com.muhend.backend.pricing.dto.PricingPlanDto;
import com.muhend.backend.pricing.dto.UpdatePricingPlanRequest;
import com.muhend.backend.pricing.service.PricingPlanService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
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
            log.info("📥 Requête GET /pricing-plans");
            log.info("📥 Paramètre marketVersion reçu: '{}'", marketVersion);
            log.info("📥 Type de marketVersion: {}", marketVersion != null ? marketVersion.getClass().getName() : "null");
            log.info("📥 marketVersion est null? {}", marketVersion == null);
            log.info("📥 marketVersion est vide? {}", marketVersion != null && marketVersion.isEmpty());
            
            List<PricingPlanDto> plans = pricingPlanService.getActivePricingPlans(marketVersion);
            log.info("📤 Réponse: {} plan(s) retourné(s)", plans.size());
            if (!plans.isEmpty()) {
                log.info("📤 Market versions des plans retournés: {}", 
                    plans.stream().map(p -> p.getName() + "=" + p.getMarketVersion()).collect(java.util.stream.Collectors.joining(", ")));
            }
            return ResponseEntity.ok(plans);
        } catch (Exception e) {
            log.error("Erreur lors de la récupération des plans tarifaires actifs", e);
            // Retourner une liste vide plutôt que de faire échouer la requête
            // Cela permet au frontend de continuer à fonctionner même si la base de données a un problème
            return ResponseEntity.ok(List.of());
        }
    }
    
    @GetMapping("/available")
    @Operation(
        summary = "Récupérer les plans tarifaires disponibles pour une organisation",
        description = "Retourne la liste des plans tarifaires disponibles pour une organisation. " +
                     "Exclut automatiquement le plan d'essai gratuit si l'organisation l'a déjà utilisé. " +
                     "Si organizationId n'est pas fourni, retourne tous les plans actifs."
    )
    public ResponseEntity<List<PricingPlanDto>> getAvailablePricingPlans(
            @RequestParam(required = false) String marketVersion,
            @RequestParam(required = false) Long organizationId) {
        try {
            log.info("📥 Requête GET /pricing-plans/available - marketVersion: {}, organizationId: {}", 
                marketVersion, organizationId);
            
            List<PricingPlanDto> plans = pricingPlanService.getAvailablePricingPlansForOrganization(
                marketVersion, organizationId);
            
            log.info("📤 Réponse: {} plan(s) disponible(s) pour l'organisation {}", plans.size(), organizationId);
            return ResponseEntity.ok(plans);
        } catch (Exception e) {
            log.error("Erreur lors de la récupération des plans tarifaires disponibles", e);
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
    
    @GetMapping("/market/{marketVersion}")
    @Operation(
        summary = "Récupérer les plans tarifaires par version de marché",
        description = "Retourne la liste des plans tarifaires actifs et standards (non personnalisés) pour une version de marché donnée."
    )
    public ResponseEntity<List<PricingPlanDto>> getPlansByMarketVersion(@PathVariable String marketVersion) {
        log.info("Requête GET /pricing-plans/market/{}", marketVersion);
        List<PricingPlanDto> plans = pricingPlanService.getPlansByMarketVersion(marketVersion);
        return ResponseEntity.ok(plans);
    }

    @GetMapping("/all")
    @Operation(
        summary = "Récupérer tous les plans tarifaires sans condition",
        description = "Retourne la liste complète de tous les plans tarifaires (actifs, inactifs, custom, tous marchés), triés par ordre d'affichage."
    )
    public ResponseEntity<List<PricingPlanDto>> getAllPricingPlans() {
        log.info("📥 Requête GET /pricing-plans/all");
        List<PricingPlanDto> plans = pricingPlanService.getAllPricingPlans();
        log.info("📤 Réponse: {} plan(s) retourné(s) (sans condition)", plans.size());
        return ResponseEntity.ok(plans);
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
        summary = "Créer un nouveau plan tarifaire",
        description = "Crée un nouveau plan tarifaire. Réservé aux administrateurs. " +
                     "Les champs obligatoires sont : name, displayOrder."
    )
    public ResponseEntity<PricingPlanDto> createPricingPlan(
            @Valid @RequestBody CreatePricingPlanRequest request) {
        log.info("Requête POST /pricing-plans - Création du plan: {}", request.getName());
        PricingPlanDto createdPlan = pricingPlanService.createPricingPlan(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdPlan);
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

