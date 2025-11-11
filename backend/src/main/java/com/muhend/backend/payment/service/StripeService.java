package com.muhend.backend.payment.service;

import com.muhend.backend.organization.service.OrganizationService;
import com.muhend.backend.payment.config.StripeConfig;
import com.muhend.backend.payment.dto.CheckoutSessionResponse;
import com.muhend.backend.payment.dto.CreateCheckoutSessionRequest;
import com.muhend.backend.pricing.service.PricingPlanService;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.Customer;
import com.stripe.model.checkout.Session;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.checkout.SessionCreateParams;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Service pour gérer les interactions avec Stripe.
 */
@Service
@Slf4j
public class StripeService {
    
    private final StripeConfig stripeConfig;
    private final PricingPlanService pricingPlanService;
    private final OrganizationService organizationService;
    
    @Value("${app.base-url:https://www.hscode.enclume-numerique.com}")
    private String baseUrl;
    
    public StripeService(
            StripeConfig stripeConfig,
            PricingPlanService pricingPlanService,
            OrganizationService organizationService) {
        this.stripeConfig = stripeConfig;
        this.pricingPlanService = pricingPlanService;
        this.organizationService = organizationService;
        
        // Initialiser Stripe avec la clé secrète
        if (stripeConfig.isConfigured()) {
            Stripe.apiKey = stripeConfig.getSecretKey();
            log.info("Stripe initialisé avec succès");
        } else {
            log.warn("Stripe n'est pas configuré. Les clés API sont manquantes.");
        }
    }
    
    /**
     * Crée une session de checkout Stripe pour un plan tarifaire.
     */
    public CheckoutSessionResponse createCheckoutSession(
            Long organizationId,
            CreateCheckoutSessionRequest request) throws StripeException {
        
        if (!stripeConfig.isConfigured()) {
            throw new IllegalStateException("Stripe n'est pas configuré. Veuillez configurer les clés API.");
        }
        
        // Récupérer le plan tarifaire
        var pricingPlan = pricingPlanService.getPricingPlanById(request.getPricingPlanId());
        
        // Récupérer l'organisation
        var organization = organizationService.getOrganizationById(organizationId);
        
        // Créer ou récupérer le client Stripe
        String customerId = getOrCreateStripeCustomer(organizationId, organization.getEmail(), organization.getName());
        
        // Construire les paramètres de la session
        SessionCreateParams.Builder sessionParamsBuilder = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                .setCustomer(customerId)
                .setSuccessUrl(request.getSuccessUrl() != null ? request.getSuccessUrl() : baseUrl + "/payment/success?session_id={CHECKOUT_SESSION_ID}")
                .setCancelUrl(request.getCancelUrl() != null ? request.getCancelUrl() : baseUrl + "/payment/cancel");
        
        // Ajouter les métadonnées
        sessionParamsBuilder.putMetadata("organization_id", organizationId.toString());
        sessionParamsBuilder.putMetadata("pricing_plan_id", request.getPricingPlanId().toString());
        if (request.getInvoiceId() != null) {
            sessionParamsBuilder.putMetadata("invoice_id", request.getInvoiceId().toString());
        }
        
        // Ajouter les items de la session
        List<SessionCreateParams.LineItem> lineItems = new ArrayList<>();
        
        // Si c'est un plan mensuel
        if (pricingPlan.getPricePerMonth() != null && pricingPlan.getPricePerMonth().compareTo(BigDecimal.ZERO) > 0) {
            SessionCreateParams.LineItem.PriceData.Recurring recurring = SessionCreateParams.LineItem.PriceData.Recurring.builder()
                    .setInterval(SessionCreateParams.LineItem.PriceData.Recurring.Interval.MONTH)
                    .build();
            
            SessionCreateParams.LineItem.PriceData priceData = SessionCreateParams.LineItem.PriceData.builder()
                    .setCurrency(stripeConfig.getCurrency().toLowerCase())
                    .setUnitAmount(pricingPlan.getPricePerMonth().multiply(BigDecimal.valueOf(100)).longValue()) // Convertir en centimes
                    .setRecurring(recurring)
                    .setProductData(
                            SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                    .setName(pricingPlan.getName())
                                    .setDescription(pricingPlan.getDescription() != null ? pricingPlan.getDescription() : "")
                                    .build()
                    )
                    .build();
            
            SessionCreateParams.LineItem lineItem = SessionCreateParams.LineItem.builder()
                    .setPriceData(priceData)
                    .setQuantity(1L)
                    .build();
            
            lineItems.add(lineItem);
        } else {
            throw new IllegalArgumentException("Ce plan tarifaire n'est pas compatible avec les abonnements récurrents. Utilisez un plan avec un prix mensuel.");
        }
        
        // Ajouter les line items un par un
        for (SessionCreateParams.LineItem lineItem : lineItems) {
            sessionParamsBuilder.addLineItem(lineItem);
        }
        
        // Si c'est un plan d'essai, ajouter la période d'essai
        if (pricingPlan.getTrialPeriodDays() != null && pricingPlan.getTrialPeriodDays() > 0) {
            sessionParamsBuilder.setSubscriptionData(
                    SessionCreateParams.SubscriptionData.builder()
                            .setTrialPeriodDays((long) pricingPlan.getTrialPeriodDays())
                            .putMetadata("pricing_plan_id", request.getPricingPlanId().toString())
                            .build()
            );
        }
        
        // Créer la session
        Session session = Session.create(sessionParamsBuilder.build());
        
        log.info("Session de checkout Stripe créée: sessionId={}, organizationId={}, pricingPlanId={}",
                session.getId(), organizationId, request.getPricingPlanId());
        
        return new CheckoutSessionResponse(
                session.getId(),
                session.getUrl(),
                stripeConfig.getPublishableKey()
        );
    }
    
    /**
     * Crée une session de checkout pour payer une facture (paiement ponctuel).
     */
    public CheckoutSessionResponse createInvoiceCheckoutSession(
            Long organizationId,
            Long invoiceId,
            String successUrl,
            String cancelUrl) throws StripeException {
        
        if (!stripeConfig.isConfigured()) {
            throw new IllegalStateException("Stripe n'est pas configuré. Veuillez configurer les clés API.");
        }
        
        // Récupérer l'organisation et la facture
        var organization = organizationService.getOrganizationById(organizationId);
        // TODO: Récupérer la facture depuis InvoiceService
        
        // Créer ou récupérer le client Stripe
        String customerId = getOrCreateStripeCustomer(organizationId, organization.getEmail(), organization.getName());
        
        // Construire les paramètres de la session (mode payment pour paiement ponctuel)
        SessionCreateParams.Builder sessionParamsBuilder = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setCustomer(customerId)
                .setSuccessUrl(successUrl != null ? successUrl : baseUrl + "/payment/success?session_id={CHECKOUT_SESSION_ID}")
                .setCancelUrl(cancelUrl != null ? cancelUrl : baseUrl + "/payment/cancel");
        
        // Ajouter les métadonnées
        sessionParamsBuilder.putMetadata("organization_id", organizationId.toString());
        sessionParamsBuilder.putMetadata("invoice_id", invoiceId.toString());
        
        // TODO: Ajouter les items de la facture comme line items
        
        // Créer la session
        Session session = Session.create(sessionParamsBuilder.build());
        
        log.info("Session de checkout Stripe créée pour facture: sessionId={}, organizationId={}, invoiceId={}",
                session.getId(), organizationId, invoiceId);
        
        return new CheckoutSessionResponse(
                session.getId(),
                session.getUrl(),
                stripeConfig.getPublishableKey()
        );
    }
    
    /**
     * Récupère ou crée un client Stripe pour une organisation.
     */
    private String getOrCreateStripeCustomer(Long organizationId, String email, String name) throws StripeException {
        // TODO: Vérifier si un client Stripe existe déjà pour cette organisation
        // Pour l'instant, on crée toujours un nouveau client
        // Dans une version future, on pourrait stocker le customer_id dans la table organization
        
        CustomerCreateParams params = CustomerCreateParams.builder()
                .setEmail(email)
                .setName(name)
                .putMetadata("organization_id", organizationId.toString())
                .build();
        
        Customer customer = Customer.create(params);
        log.info("Client Stripe créé: customerId={}, organizationId={}", customer.getId(), organizationId);
        
        return customer.getId();
    }
    
    /**
     * Récupère une session de checkout par son ID.
     */
    public Session getCheckoutSession(String sessionId) throws StripeException {
        return Session.retrieve(sessionId);
    }
}

