package com.muhend.backend.pricing.service;

import com.muhend.backend.pricing.model.PricingPlan;
import com.muhend.backend.pricing.repository.PricingPlanRepository;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

/**
 * Service pour initialiser les plans tarifaires par défaut.
 */
@Service
@Slf4j
public class PricingPlanInitializationService {
    
    @Autowired
    private PricingPlanRepository pricingPlanRepository;
    
    @PostConstruct
    @Transactional
    public void initializePricingPlans() {
        if (pricingPlanRepository.count() == 0) {
            log.info("Initialisation des plans tarifaires par défaut...");
            
            // Plan d'essai gratuit
            PricingPlan trial = new PricingPlan();
            trial.setName("Essai gratuit");
            trial.setDescription("20 requêtes gratuites valables pendant une semaine");
            trial.setPricePerMonth(BigDecimal.ZERO);
            trial.setPricePerRequest(null);
            trial.setMonthlyQuota(20);
            trial.setTrialPeriodDays(7);
            trial.setFeatures("20 requêtes gratuites, Valable 7 jours, Accès à toutes les fonctionnalités");
            trial.setIsActive(true);
            trial.setDisplayOrder(0);
            pricingPlanRepository.save(trial);
            
            // Plan facturé à la requête
            PricingPlan payPerRequest = new PricingPlan();
            payPerRequest.setName("Pay-per-Request");
            payPerRequest.setDescription("Facturation à la requête sans limite de temps");
            payPerRequest.setPricePerMonth(null);
            payPerRequest.setPricePerRequest(new BigDecimal("0.05")); // 5 centimes par requête
            payPerRequest.setMonthlyQuota(null); // Pas de quota mensuel
            payPerRequest.setTrialPeriodDays(null);
            payPerRequest.setFeatures("Facturation à la requête, Pas de limite de temps, Pas de quota mensuel, Support par email");
            payPerRequest.setIsActive(true);
            payPerRequest.setDisplayOrder(1);
            pricingPlanRepository.save(payPerRequest);
            
            PricingPlan starter = new PricingPlan();
            starter.setName("Starter");
            starter.setDescription("Plan de démarrage idéal pour les petites entreprises");
            starter.setPricePerMonth(new BigDecimal("29.99"));
            starter.setPricePerRequest(null);
            starter.setMonthlyQuota(1000);
            starter.setTrialPeriodDays(null);
            starter.setFeatures("1000 requêtes/mois, Support par email, Accès à toutes les fonctionnalités de base");
            starter.setIsActive(true);
            starter.setDisplayOrder(2);
            pricingPlanRepository.save(starter);
            
            PricingPlan professional = new PricingPlan();
            professional.setName("Professional");
            professional.setDescription("Plan professionnel pour les entreprises en croissance");
            professional.setPricePerMonth(new BigDecimal("79.99"));
            professional.setPricePerRequest(null);
            professional.setMonthlyQuota(5000);
            professional.setTrialPeriodDays(null);
            professional.setFeatures("5000 requêtes/mois, Support prioritaire, Accès à toutes les fonctionnalités, Rapports détaillés");
            professional.setIsActive(true);
            professional.setDisplayOrder(3);
            pricingPlanRepository.save(professional);
            
            PricingPlan enterprise = new PricingPlan();
            enterprise.setName("Enterprise");
            enterprise.setDescription("Plan entreprise avec quota illimité");
            enterprise.setPricePerMonth(new BigDecimal("199.99"));
            enterprise.setPricePerRequest(null);
            enterprise.setMonthlyQuota(null); // Illimité
            enterprise.setTrialPeriodDays(null);
            enterprise.setFeatures("Quota illimité, Support dédié 24/7, Toutes les fonctionnalités, Rapports avancés, Personnalisation");
            enterprise.setIsActive(true);
            enterprise.setDisplayOrder(4);
            pricingPlanRepository.save(enterprise);
            
            log.info("Plans tarifaires initialisés avec succès");
        } else {
            log.debug("Les plans tarifaires existent déjà, pas d'initialisation nécessaire");
        }
    }
}

