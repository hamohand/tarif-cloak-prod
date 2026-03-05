package com.muhend.backend.payment.config;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration pour Chargily Pay (passerelle de paiement algérienne — DZD).
 * Supporte CIB (SATIM) et EDAHABIA (Algérie Poste).
 * Les clés API doivent être définies dans les variables d'environnement.
 */
@Configuration
@Getter
public class ChargilyConfig {

    @Value("${chargily.secret-key:}")
    private String secretKey;

    @Value("${chargily.webhook-secret:}")
    private String webhookSecret;

    @Value("${chargily.api-url:https://pay.chargily.net/api/v2}")
    private String apiUrl;

    @Value("${chargily.currency:dzd}")
    private String currency;

    /**
     * Vérifie si Chargily est configuré.
     */
    public boolean isConfigured() {
        return secretKey != null && !secretKey.isEmpty();
    }
}
