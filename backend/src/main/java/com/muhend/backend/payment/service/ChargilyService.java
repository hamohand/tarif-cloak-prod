package com.muhend.backend.payment.service;

import com.muhend.backend.invoice.model.Invoice;
import com.muhend.backend.invoice.service.InvoiceService;
import com.muhend.backend.organization.service.OrganizationService;
import com.muhend.backend.payment.config.ChargilyConfig;
import com.muhend.backend.payment.dto.CheckoutSessionResponse;
import com.muhend.backend.payment.dto.CreateCheckoutSessionRequest;
import com.muhend.backend.pricing.service.PricingPlanService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

/**
 * Service pour créer des sessions de paiement via Chargily Pay v2.
 * Supporte CIB (SATIM) et EDAHABIA (Algérie Poste) — devise DZD uniquement.
 *
 * Chargily ne gère que des paiements ponctuels (pas d'abonnements récurrents).
 * Le renouvellement mensuel est géré par MonthlyPlanSchedulerService.
 */
@Service
@Slf4j
public class ChargilyService {

    private final ChargilyConfig config;
    private final PricingPlanService pricingPlanService;
    private final OrganizationService organizationService;
    private final InvoiceService invoiceService;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${app.base-url:https://www.hscode.enclume-numerique.com}")
    private String baseUrl;

    public ChargilyService(
            ChargilyConfig config,
            PricingPlanService pricingPlanService,
            OrganizationService organizationService,
            InvoiceService invoiceService) {
        this.config = config;
        this.pricingPlanService = pricingPlanService;
        this.organizationService = organizationService;
        this.invoiceService = invoiceService;

        if (config.isConfigured()) {
            log.info("Chargily Pay initialisé avec succès");
        } else {
            log.warn("Chargily Pay n'est pas configuré. La clé API est manquante.");
        }
    }

    /**
     * Crée un checkout Chargily pour souscrire à un plan tarifaire (paiement du premier mois).
     */
    public CheckoutSessionResponse createCheckoutSession(
            Long organizationId,
            CreateCheckoutSessionRequest request) {

        if (!config.isConfigured()) {
            throw new IllegalStateException("Chargily Pay n'est pas configuré. Veuillez configurer la clé API.");
        }

        var plan = pricingPlanService.getPricingPlanById(request.getPricingPlanId());
        var org = organizationService.getOrganizationById(organizationId);

        if (plan.getPricePerMonth() == null || plan.getPricePerMonth().longValue() <= 0) {
            throw new IllegalArgumentException("Ce plan n'a pas de prix mensuel valide.");
        }

        long amount = plan.getPricePerMonth().longValue();

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("organization_id", organizationId.toString());
        metadata.put("pricing_plan_id", request.getPricingPlanId().toString());
        if (request.getInvoiceId() != null) {
            metadata.put("invoice_id", request.getInvoiceId().toString());
        }

        Map<String, Object> body = new HashMap<>();
        body.put("amount", amount);
        body.put("currency", config.getCurrency());
        body.put("success_url", request.getSuccessUrl() != null
                ? request.getSuccessUrl() : baseUrl + "/payment/success");
        body.put("failure_url", request.getCancelUrl() != null
                ? request.getCancelUrl() : baseUrl + "/payment/cancel");
        body.put("locale", "fr");
        body.put("description", "Abonnement " + plan.getName() + " — " + org.getName());
        body.put("metadata", metadata);

        log.info("Création checkout Chargily: organizationId={}, planId={}, amount={} DZD",
                organizationId, request.getPricingPlanId(), amount);

        return doCreateCheckout(body);
    }

    /**
     * Crée un checkout Chargily pour payer une facture existante.
     */
    public CheckoutSessionResponse createInvoiceCheckoutSession(
            Long organizationId,
            Long invoiceId,
            String successUrl,
            String cancelUrl) {

        if (!config.isConfigured()) {
            throw new IllegalStateException("Chargily Pay n'est pas configuré. Veuillez configurer la clé API.");
        }

        var invoice = invoiceService.getInvoiceById(invoiceId);

        if (!invoice.getOrganizationId().equals(organizationId)) {
            throw new IllegalArgumentException("La facture n'appartient pas à cette organisation");
        }
        if (invoice.getStatus() == Invoice.InvoiceStatus.PAID) {
            throw new IllegalStateException("Cette facture est déjà payée");
        }

        long amount = invoice.getTotalAmount().longValue();

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("organization_id", organizationId.toString());
        metadata.put("invoice_id", invoiceId.toString());

        Map<String, Object> body = new HashMap<>();
        body.put("amount", amount);
        body.put("currency", config.getCurrency());
        body.put("success_url", successUrl != null ? successUrl : baseUrl + "/payment/success");
        body.put("failure_url", cancelUrl != null ? cancelUrl : baseUrl + "/payment/cancel");
        body.put("locale", "fr");
        body.put("description", "Facture " + invoice.getInvoiceNumber());
        body.put("metadata", metadata);

        log.info("Création checkout Chargily pour facture: organizationId={}, invoiceId={}, amount={} DZD",
                organizationId, invoiceId, amount);

        return doCreateCheckout(body);
    }

    /**
     * Envoie la requête de création de checkout à l'API Chargily.
     */
    private CheckoutSessionResponse doCreateCheckout(Map<String, Object> body) {
        // Chargily envoie le webhook à cette URL après chaque paiement
        body.put("webhook_url", baseUrl + "/api/webhooks/chargily");

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(config.getSecretKey());
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                config.getApiUrl() + "/checkouts",
                HttpMethod.POST,
                entity,
                new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {});

        if (response.getBody() == null) {
            throw new IllegalStateException("Réponse vide de l'API Chargily");
        }

        String checkoutId  = (String) response.getBody().get("id");
        String checkoutUrl = (String) response.getBody().get("checkout_url");

        log.info("Checkout Chargily créé: id={}", checkoutId);

        // publishableKey = null (non applicable pour Chargily)
        return new CheckoutSessionResponse(checkoutId, checkoutUrl, null);
    }
}
