package com.muhend.backend.payment.controller;

import com.muhend.backend.payment.config.StripeConfig;
import com.muhend.backend.payment.model.Subscription;
import com.muhend.backend.payment.repository.SubscriptionRepository;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.PaymentIntent;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;

/**
 * Controller pour gérer les webhooks Stripe.
 * Les webhooks permettent à Stripe de notifier l'application des événements de paiement.
 */
@RestController
@RequestMapping("/webhooks/stripe")
@Slf4j
public class StripeWebhookController {
    
    private final StripeConfig stripeConfig;
    private final SubscriptionRepository subscriptionRepository;
    
    public StripeWebhookController(
            StripeConfig stripeConfig,
            SubscriptionRepository subscriptionRepository) {
        this.stripeConfig = stripeConfig;
        this.subscriptionRepository = subscriptionRepository;
    }
    
    /**
     * Endpoint pour recevoir les webhooks Stripe.
     * Cet endpoint doit être public (non authentifié) car Stripe envoie les webhooks directement.
     * La sécurité est assurée par la vérification de la signature Stripe.
     */
    @PostMapping
    public ResponseEntity<String> handleWebhook(
            @RequestBody String payload,
            @RequestHeader("Stripe-Signature") String sigHeader) {
        
        if (!stripeConfig.isConfigured() || stripeConfig.getWebhookSecret().isEmpty()) {
            log.error("Stripe webhook secret n'est pas configuré");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Webhook secret not configured");
        }
        
        Event event;
        
        try {
            // Vérifier la signature du webhook
            event = Webhook.constructEvent(
                    payload, sigHeader, stripeConfig.getWebhookSecret());
        } catch (SignatureVerificationException e) {
            log.error("Erreur de vérification de signature du webhook Stripe", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid signature");
        } catch (Exception e) {
            log.error("Erreur lors du traitement du webhook Stripe", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Error processing webhook");
        }
        
        // Traiter l'événement
        log.info("Webhook Stripe reçu: type={}, id={}", event.getType(), event.getId());
        
        try {
            switch (event.getType()) {
                case "checkout.session.completed":
                    handleCheckoutSessionCompleted(event);
                    break;
                case "customer.subscription.created":
                case "customer.subscription.updated":
                    handleSubscriptionUpdated(event);
                    break;
                case "customer.subscription.deleted":
                    handleSubscriptionDeleted(event);
                    break;
                case "invoice.payment_succeeded":
                    handleInvoicePaymentSucceeded(event);
                    break;
                case "invoice.payment_failed":
                    handleInvoicePaymentFailed(event);
                    break;
                case "payment_intent.succeeded":
                    handlePaymentIntentSucceeded(event);
                    break;
                case "payment_intent.payment_failed":
                    handlePaymentIntentFailed(event);
                    break;
                default:
                    log.debug("Événement Stripe non géré: {}", event.getType());
            }
        } catch (Exception e) {
            log.error("Erreur lors du traitement de l'événement Stripe: {}", event.getType(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error processing event");
        }
        
        return ResponseEntity.ok("Webhook processed successfully");
    }
    
    /**
     * Gère l'événement checkout.session.completed.
     * Se déclenche quand un utilisateur complète le checkout.
     */
    private void handleCheckoutSessionCompleted(Event event) {
        Session session = (Session) event.getDataObjectDeserializer().getObject().orElse(null);
        if (session == null) {
            log.warn("Session null dans checkout.session.completed");
            return;
        }
        
        log.info("Checkout session complétée: sessionId={}, customerId={}, subscriptionId={}",
                session.getId(), session.getCustomer(), session.getSubscription());
        
        // Si c'est un abonnement, il sera créé/mis à jour par l'événement customer.subscription.created/updated
        // Si c'est un paiement ponctuel, il sera géré par payment_intent.succeeded
    }
    
    /**
     * Gère les événements customer.subscription.created et customer.subscription.updated.
     */
    private void handleSubscriptionUpdated(Event event) {
        com.stripe.model.Subscription stripeSubscription = 
                (com.stripe.model.Subscription) event.getDataObjectDeserializer().getObject().orElse(null);
        if (stripeSubscription == null) {
            log.warn("Subscription null dans customer.subscription.updated");
            return;
        }
        
        log.info("Abonnement Stripe créé/mis à jour: subscriptionId={}, status={}",
                stripeSubscription.getId(), stripeSubscription.getStatus());
        
        // Récupérer les métadonnées
        Map<String, String> metadata = stripeSubscription.getMetadata();
        String organizationIdStr = metadata.get("organization_id");
        String pricingPlanIdStr = metadata.get("pricing_plan_id");
        
        if (organizationIdStr == null || pricingPlanIdStr == null) {
            log.warn("Métadonnées manquantes dans l'abonnement Stripe: organizationId={}, pricingPlanId={}",
                    organizationIdStr, pricingPlanIdStr);
            return;
        }
        
        Long organizationId = Long.parseLong(organizationIdStr);
        Long pricingPlanId = Long.parseLong(pricingPlanIdStr);
        
        // Vérifier si l'abonnement existe déjà
        Subscription subscription = subscriptionRepository
                .findByPaymentProviderSubscriptionId(stripeSubscription.getId())
                .orElse(null);
        
        if (subscription == null) {
            // Créer un nouvel abonnement
            subscription = new Subscription();
            subscription.setOrganizationId(organizationId);
            subscription.setPricingPlanId(pricingPlanId);
            subscription.setPaymentProvider("stripe");
            subscription.setPaymentProviderSubscriptionId(stripeSubscription.getId());
            subscription.setPaymentProviderCustomerId(stripeSubscription.getCustomer());
        }
        
        // Mettre à jour les informations
        subscription.setStatus(mapStripeSubscriptionStatus(stripeSubscription.getStatus()));
        subscription.setCurrentPeriodStart(toLocalDateTime(stripeSubscription.getCurrentPeriodStart()));
        subscription.setCurrentPeriodEnd(toLocalDateTime(stripeSubscription.getCurrentPeriodEnd()));
        
        if (stripeSubscription.getTrialEnd() != null) {
            subscription.setTrialStart(toLocalDateTime(stripeSubscription.getTrialStart()));
            subscription.setTrialEnd(toLocalDateTime(stripeSubscription.getTrialEnd()));
        }
        
        if (stripeSubscription.getCanceledAt() != null) {
            subscription.setCanceledAt(toLocalDateTime(stripeSubscription.getCanceledAt()));
        }
        
        subscription.setCancelAtPeriodEnd(stripeSubscription.getCancelAtPeriodEnd() != null && stripeSubscription.getCancelAtPeriodEnd());
        
        subscriptionRepository.save(subscription);
        log.info("Abonnement sauvegardé: id={}, organizationId={}", subscription.getId(), organizationId);
    }
    
    /**
     * Gère l'événement customer.subscription.deleted.
     */
    private void handleSubscriptionDeleted(Event event) {
        com.stripe.model.Subscription stripeSubscription = 
                (com.stripe.model.Subscription) event.getDataObjectDeserializer().getObject().orElse(null);
        if (stripeSubscription == null) {
            return;
        }
        
        subscriptionRepository.findByPaymentProviderSubscriptionId(stripeSubscription.getId())
                .ifPresent(subscription -> {
                    subscription.setStatus(Subscription.SubscriptionStatus.CANCELED);
                    subscription.setCanceledAt(LocalDateTime.now());
                    subscriptionRepository.save(subscription);
                    log.info("Abonnement annulé: id={}", subscription.getId());
                });
    }
    
    /**
     * Gère l'événement invoice.payment_succeeded.
     */
    private void handleInvoicePaymentSucceeded(Event event) {
        com.stripe.model.Invoice stripeInvoice = 
                (com.stripe.model.Invoice) event.getDataObjectDeserializer().getObject().orElse(null);
        if (stripeInvoice == null) {
            return;
        }
        
        log.info("Paiement de facture réussi: invoiceId={}, amount={}",
                stripeInvoice.getId(), stripeInvoice.getAmountPaid());
        
        // TODO: Créer/mettre à jour le paiement dans la base de données
        // TODO: Mettre à jour le statut de la facture locale si elle existe
    }
    
    /**
     * Gère l'événement invoice.payment_failed.
     */
    private void handleInvoicePaymentFailed(Event event) {
        com.stripe.model.Invoice stripeInvoice = 
                (com.stripe.model.Invoice) event.getDataObjectDeserializer().getObject().orElse(null);
        if (stripeInvoice == null) {
            return;
        }
        
        log.warn("Échec du paiement de facture: invoiceId={}", stripeInvoice.getId());
        
        // TODO: Mettre à jour le statut de l'abonnement en PAST_DUE
        // TODO: Notifier l'organisation
    }
    
    /**
     * Gère l'événement payment_intent.succeeded.
     */
    private void handlePaymentIntentSucceeded(Event event) {
        PaymentIntent paymentIntent = 
                (PaymentIntent) event.getDataObjectDeserializer().getObject().orElse(null);
        if (paymentIntent == null) {
            return;
        }
        
        log.info("Paiement réussi: paymentIntentId={}, amount={}",
                paymentIntent.getId(), paymentIntent.getAmount());
        
        // TODO: Créer/mettre à jour le paiement dans la base de données
    }
    
    /**
     * Gère l'événement payment_intent.payment_failed.
     */
    private void handlePaymentIntentFailed(Event event) {
        PaymentIntent paymentIntent = 
                (PaymentIntent) event.getDataObjectDeserializer().getObject().orElse(null);
        if (paymentIntent == null) {
            return;
        }
        
        log.warn("Échec du paiement: paymentIntentId={}", paymentIntent.getId());
        
        // TODO: Enregistrer l'échec du paiement
    }
    
    /**
     * Convertit un statut d'abonnement Stripe en statut local.
     */
    private Subscription.SubscriptionStatus mapStripeSubscriptionStatus(String stripeStatus) {
        return switch (stripeStatus) {
            case "trialing" -> Subscription.SubscriptionStatus.TRIALING;
            case "active" -> Subscription.SubscriptionStatus.ACTIVE;
            case "past_due" -> Subscription.SubscriptionStatus.PAST_DUE;
            case "canceled", "unpaid" -> Subscription.SubscriptionStatus.CANCELED;
            case "incomplete" -> Subscription.SubscriptionStatus.INCOMPLETE;
            case "incomplete_expired" -> Subscription.SubscriptionStatus.INCOMPLETE_EXPIRED;
            case "paused" -> Subscription.SubscriptionStatus.PAUSED;
            default -> Subscription.SubscriptionStatus.UNPAID;
        };
    }
    
    /**
     * Convertit un timestamp Unix en LocalDateTime.
     */
    private LocalDateTime toLocalDateTime(Long timestamp) {
        if (timestamp == null) {
            return null;
        }
        return LocalDateTime.ofInstant(Instant.ofEpochSecond(timestamp), ZoneId.systemDefault());
    }
}

