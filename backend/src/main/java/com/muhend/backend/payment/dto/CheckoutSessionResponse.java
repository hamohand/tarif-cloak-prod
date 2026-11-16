package com.muhend.backend.payment.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO pour la réponse d'une session de checkout (ou repli facture/virement).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CheckoutSessionResponse {

    private String sessionId; // ID de la session Stripe / Chargily ou référence de repli
    private String url; // URL de redirection externe ou route interne de demande sur facture
    private String publishableKey; // Clé publique Stripe (pour le frontend)
    private boolean manualInvoiceFallback; // true si la passerelle en ligne n'est pas configurée
    private String message; // Message explicatif pour le frontend

    public CheckoutSessionResponse(String sessionId, String url, String publishableKey) {
        this.sessionId = sessionId;
        this.url = url;
        this.publishableKey = publishableKey;
        this.manualInvoiceFallback = false;
        this.message = null;
    }
}
