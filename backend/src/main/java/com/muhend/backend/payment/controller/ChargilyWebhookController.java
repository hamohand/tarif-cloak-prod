package com.muhend.backend.payment.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.muhend.backend.invoice.model.Invoice;
import com.muhend.backend.invoice.repository.InvoiceRepository;
import com.muhend.backend.payment.config.ChargilyConfig;
import com.muhend.backend.payment.model.Payment;
import com.muhend.backend.payment.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Map;

/**
 * Controller pour recevoir les webhooks Chargily Pay.
 * Route : POST /webhooks/chargily (public via SecurityConfig /webhooks/**)
 *
 * La sécurité est assurée par vérification HMAC-SHA256 de la signature.
 */
@RestController
@RequestMapping("/webhooks/chargily")
@RequiredArgsConstructor
@Slf4j
public class ChargilyWebhookController {

    private final ChargilyConfig config;
    private final PaymentRepository paymentRepository;
    private final InvoiceRepository invoiceRepository;
    private final ObjectMapper objectMapper;

    @PostMapping
    public ResponseEntity<String> handleWebhook(
            @RequestBody String payload,
            @RequestHeader("signature") String signature) {

        if (!config.isConfigured() || config.getWebhookSecret().isEmpty()) {
            log.error("Chargily webhook secret non configuré");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Webhook secret not configured");
        }

        if (!verifySignature(payload, signature)) {
            log.error("Signature webhook Chargily invalide");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid signature");
        }

        try {
            Map<String, Object> event = objectMapper.readValue(
                    payload, new TypeReference<Map<String, Object>>() {});

            String type = (String) event.get("type");
            String eventId = (String) event.get("id");

            log.info("Webhook Chargily reçu: type={}, id={}", type, eventId);

            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) event.get("data");

            switch (type != null ? type : "") {
                case "checkout.paid"     -> handlePaid(data);
                case "checkout.failed"   -> handleFailed(data);
                case "checkout.canceled" -> handleCanceled(data);
                default -> log.debug("Événement Chargily non géré: {}", type);
            }

        } catch (Exception e) {
            log.error("Erreur lors du traitement du webhook Chargily", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error processing webhook");
        }

        return ResponseEntity.ok("ok");
    }

    /**
     * Paiement réussi : enregistre le paiement et marque la facture comme payée.
     */
    @SuppressWarnings("unchecked")
    private void handlePaid(Map<String, Object> data) {
        String checkoutId = (String) data.get("id");
        Number amountRaw  = (Number) data.get("amount");
        BigDecimal amount = amountRaw != null
                ? BigDecimal.valueOf(amountRaw.longValue()) : BigDecimal.ZERO;

        Map<String, String> metadata = (Map<String, String>) data.get("metadata");
        if (metadata == null) {
            log.warn("Pas de metadata dans checkout.paid: checkoutId={}", checkoutId);
            return;
        }

        String orgIdStr     = metadata.get("organization_id");
        String invoiceIdStr = metadata.get("invoice_id");

        Long organizationId = orgIdStr != null ? Long.parseLong(orgIdStr) : null;
        if (organizationId == null) {
            log.warn("organization_id manquant dans les metadata Chargily: checkoutId={}", checkoutId);
            return;
        }

        // Créer l'enregistrement de paiement
        Payment payment = new Payment();
        payment.setOrganizationId(organizationId);
        payment.setAmount(amount);
        payment.setCurrency("DZD");
        payment.setStatus(Payment.PaymentStatus.SUCCEEDED);
        payment.setPaymentProvider("chargily");
        payment.setPaymentProviderPaymentId(checkoutId);
        payment.setDescription("Paiement Chargily" + (invoiceIdStr != null ? " — Facture #" + invoiceIdStr : ""));
        payment.setPaidAt(LocalDateTime.now());
        paymentRepository.save(payment);

        log.info("Paiement Chargily enregistré: id={}, organizationId={}, amount={} DZD",
                payment.getId(), organizationId, amount);

        // Marquer la facture comme payée si invoice_id présent
        if (invoiceIdStr != null) {
            try {
                Long invoiceId = Long.parseLong(invoiceIdStr);
                invoiceRepository.findById(invoiceId).ifPresent(invoice -> {
                    invoice.setStatus(Invoice.InvoiceStatus.PAID);
                    invoice.setPaidAt(LocalDateTime.now());
                    invoice.setPaymentId(payment.getId());
                    invoice.setPaymentProvider("chargily");
                    invoice.setPaymentProviderInvoiceId(checkoutId);
                    invoiceRepository.save(invoice);
                    log.info("Facture marquée PAID: invoiceId={}", invoiceId);
                });
            } catch (NumberFormatException e) {
                log.warn("invoice_id invalide dans les metadata Chargily: {}", invoiceIdStr);
            }
        }
    }

    /**
     * Paiement échoué : enregistre l'échec.
     */
    @SuppressWarnings("unchecked")
    private void handleFailed(Map<String, Object> data) {
        String checkoutId = (String) data.get("id");
        Number amountRaw  = (Number) data.get("amount");

        Map<String, String> metadata = (Map<String, String>) data.get("metadata");
        String orgIdStr = metadata != null ? metadata.get("organization_id") : null;

        Payment payment = new Payment();
        if (orgIdStr != null) payment.setOrganizationId(Long.parseLong(orgIdStr));
        payment.setAmount(amountRaw != null ? BigDecimal.valueOf(amountRaw.longValue()) : BigDecimal.ZERO);
        payment.setCurrency("DZD");
        payment.setStatus(Payment.PaymentStatus.FAILED);
        payment.setPaymentProvider("chargily");
        payment.setPaymentProviderPaymentId(checkoutId);
        payment.setDescription("Échec paiement Chargily");
        payment.setFailureReason("Paiement échoué ou refusé");
        paymentRepository.save(payment);

        log.warn("Paiement Chargily échoué: checkoutId={}", checkoutId);
    }

    /**
     * Paiement annulé : enregistre l'annulation.
     */
    @SuppressWarnings("unchecked")
    private void handleCanceled(Map<String, Object> data) {
        String checkoutId = (String) data.get("id");
        Number amountRaw  = (Number) data.get("amount");

        Map<String, String> metadata = (Map<String, String>) data.get("metadata");
        String orgIdStr = metadata != null ? metadata.get("organization_id") : null;

        Payment payment = new Payment();
        if (orgIdStr != null) payment.setOrganizationId(Long.parseLong(orgIdStr));
        payment.setAmount(amountRaw != null ? BigDecimal.valueOf(amountRaw.longValue()) : BigDecimal.ZERO);
        payment.setCurrency("DZD");
        payment.setStatus(Payment.PaymentStatus.CANCELED);
        payment.setPaymentProvider("chargily");
        payment.setPaymentProviderPaymentId(checkoutId);
        payment.setDescription("Paiement Chargily annulé");
        paymentRepository.save(payment);

        log.info("Paiement Chargily annulé: checkoutId={}", checkoutId);
    }

    /**
     * Vérifie la signature HMAC-SHA256 du webhook Chargily.
     * Utilise MessageDigest.isEqual() pour éviter les attaques de timing.
     */
    private boolean verifySignature(String payload, String receivedSignature) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(
                    config.getWebhookSecret().getBytes(StandardCharsets.UTF_8),
                    "HmacSHA256"));
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String computed = HexFormat.of().formatHex(hash);
            return MessageDigest.isEqual(
                    computed.getBytes(StandardCharsets.UTF_8),
                    receivedSignature.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            log.error("Erreur lors de la vérification de signature Chargily", e);
            return false;
        }
    }
}
