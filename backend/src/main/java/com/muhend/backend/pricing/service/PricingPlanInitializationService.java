package com.muhend.backend.pricing.service;

import com.muhend.backend.pricing.model.PricingPlan;
import com.muhend.backend.pricing.repository.PricingPlanRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

/**
 * Service pour initialiser les plans tarifaires par défaut (DEFAULT/EUR et DZ/DZD).
 * S'exécute après la correction du schéma de la table.
 */
@Service
@Slf4j
@Order(2)
public class PricingPlanInitializationService {

    @Autowired
    private PricingPlanRepository pricingPlanRepository;

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void initializePricingPlans() {
        log.info("Vérification et initialisation des plans tarifaires (DEFAULT/EUR et DZ/DZD)...");

        // Marché DEFAULT (Europe & International — EUR)
        ensurePlan("Invité", "DEFAULT", "EUR",
                "Accès beta-testeur — 500 crédits offerts pendant 30 jours",
                BigDecimal.ZERO, null, 500, 30, -1,
                "500 crédits gratuits, Accès complet pendant 30 jours, Réservé aux beta-testeurs");
        ensurePlan("Essai gratuit", "DEFAULT", "EUR",
                "Découverte complète — Décodage & Comparaison illimités + 225 crédits offerts (30 jours)",
                BigDecimal.ZERO, null, 225, 30, 0,
                "Décodage & Comparaison DZ ↔ UE illimités, 225 crédits de recherche assistée (~15 recherches P10/NC8), Valable 30 jours sans engagement");
        ensurePlan("Essentiel", "DEFAULT", "EUR",
                "PME & importateurs/exportateurs réguliers — ~100 recherches assistées/mois + décodage illimité",
                new BigDecimal("29.00"), new BigDecimal("290.00"), 1500, null, 1,
                "Décodage & Comparaison DZ ↔ UE illimités, 1 500 crédits / mois (~100 recherches P10/NC8), Import de listes CSV, Support par email");
        ensurePlan("Pro / Transit", "DEFAULT", "EUR",
                "Transitaires, commissionnaires en douane & cabinets conseil — ~500 recherches assistées/mois",
                new BigDecimal("79.00"), new BigDecimal("790.00"), 7500, null, 2,
                "Décodage & Comparaison DZ ↔ UE illimités, 7 500 crédits / mois (~500 recherches P10/NC8), Listes CSV & traitement Batch, Multi-collaborateurs & statistiques");
        ensurePlan("Entreprise", "DEFAULT", "EUR",
                "Grands comptes & groupes logistiques — ~2 000 recherches assistées/mois",
                new BigDecimal("199.00"), new BigDecimal("1990.00"), 30000, null, 3,
                "Décodage & Comparaison DZ ↔ UE illimités, 30 000 crédits / mois (~2 000 recherches P10/NC8), Multi-collaborateurs illimités & Batch, Facturation annuelle ou devis sur mesure");

        // Marché DZ (Algérie — DZD)
        ensurePlan("Invité", "DZ", "DZD",
                "Accès beta-testeur — 500 crédits offerts pendant 30 jours",
                BigDecimal.ZERO, null, 500, 30, -1,
                "500 crédits gratuits, Accès complet pendant 30 jours, Réservé aux beta-testeurs");
        ensurePlan("Essai gratuit", "DZ", "DZD",
                "Découverte complète — Décodage & Comparaison illimités + 225 crédits offerts (30 jours)",
                BigDecimal.ZERO, null, 225, 30, 0,
                "Décodage & Comparaison DZ ↔ UE illimités, 225 crédits de recherche assistée (~15 recherches P10/NC8), Valable 30 jours sans engagement");
        ensurePlan("Essentiel", "DZ", "DZD",
                "PME & importateurs/exportateurs réguliers — ~100 recherches assistées/mois + décodage illimité",
                new BigDecimal("3900.00"), new BigDecimal("39000.00"), 1500, null, 1,
                "Décodage & Comparaison DZ ↔ UE illimités, 1 500 crédits / mois (~100 recherches P10/NC8), Import de listes CSV, Paiement CIB / Edahabia ou virement");
        ensurePlan("Pro / Transit", "DZ", "DZD",
                "Transitaires, commissionnaires en douane & cabinets conseil — ~500 recherches assistées/mois",
                new BigDecimal("9900.00"), new BigDecimal("99000.00"), 7500, null, 2,
                "Décodage & Comparaison DZ ↔ UE illimités, 7 500 crédits / mois (~500 recherches P10/NC8), Listes CSV & traitement Batch, Multi-collaborateurs & statistiques, Paiement CIB / Edahabia ou virement annuel");
        ensurePlan("Entreprise", "DZ", "DZD",
                "Grands comptes & groupes logistiques — ~2 000 recherches assistées/mois",
                new BigDecimal("24000.00"), new BigDecimal("240000.00"), 30000, null, 3,
                "Décodage & Comparaison DZ ↔ UE illimités, 30 000 crédits / mois (~2 000 recherches P10/NC8), Multi-collaborateurs illimités & Batch, Facturation annuelle par virement / bon de commande");

        log.info("Vérification des plans tarifaires terminée");
    }

    private void ensurePlan(
            String name,
            String marketVersion,
            String currency,
            String description,
            BigDecimal pricePerMonth,
            BigDecimal pricePerYear,
            Integer monthlyQuota,
            Integer trialPeriodDays,
            int displayOrder,
            String features) {
        if (pricingPlanRepository.existsByNameAndMarketVersion(name, marketVersion)) {
            return;
        }
        PricingPlan plan = new PricingPlan();
        plan.setName(name);
        plan.setMarketVersion(marketVersion);
        plan.setCurrency(currency);
        plan.setDescription(description);
        plan.setPricePerMonth(pricePerMonth);
        plan.setPricePerYear(pricePerYear);
        plan.setPricePerRequest(null);
        plan.setMonthlyQuota(monthlyQuota);
        plan.setTrialPeriodDays(trialPeriodDays);
        plan.setFeatures(features);
        plan.setIsActive(true);
        plan.setIsCustom(false);
        plan.setDisplayOrder(displayOrder);
        pricingPlanRepository.save(plan);
        log.info("Plan '{}' créé pour le marché {} ({})", name, marketVersion, currency);
    }
}
