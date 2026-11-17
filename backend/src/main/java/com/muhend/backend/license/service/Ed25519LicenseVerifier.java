package com.muhend.backend.license.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.muhend.backend.license.dto.LicensePayload;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

/**
 * Vérificateur cryptographique Ed25519 (API standard Java 21) pour les jetons de licence On-Premise.
 * Format du jeton : {@code TCI1.<payloadBase64Url>.<signatureBase64Url>}
 * où la signature porte sur les octets UTF-8 de {@code TCI1.<payloadBase64Url>}.
 */
@Component
public class Ed25519LicenseVerifier {

    public static final String TOKEN_PREFIX = "TCI1";

    private static final ObjectMapper OBJECT_MAPPER = JsonMapper.builder()
            .addModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .build();

    public static class LicenseVerificationException extends RuntimeException {
        public LicenseVerificationException(String message) {
            super(message);
        }

        public LicenseVerificationException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    public LicensePayload verifyAndParse(String rawToken, String publicKeyBase64) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new LicenseVerificationException("Jeton de licence vide");
        }
        if (publicKeyBase64 == null || publicKeyBase64.isBlank()) {
            throw new LicenseVerificationException("Clé publique Ed25519 manquante");
        }

        String normalizedToken = rawToken.replaceAll("\\s+", "");
        String[] parts = normalizedToken.split("\\.");
        if (parts.length != 3 || !TOKEN_PREFIX.equals(parts[0])) {
            throw new LicenseVerificationException("Format de jeton invalide (attendu : TCI1.<payload>.<signature>)");
        }

        try {
            PublicKey publicKey = decodePublicKey(publicKeyBase64);
            byte[] signingInput = (parts[0] + "." + parts[1]).getBytes(StandardCharsets.UTF_8);
            byte[] signatureBytes = Base64.getUrlDecoder().decode(parts[2]);

            Signature verifier = Signature.getInstance("Ed25519");
            verifier.initVerify(publicKey);
            verifier.update(signingInput);
            if (!verifier.verify(signatureBytes)) {
                throw new LicenseVerificationException("Signature Ed25519 de la licence invalide");
            }

            byte[] payloadBytes = Base64.getUrlDecoder().decode(parts[1]);
            LicensePayload payload = OBJECT_MAPPER.readValue(payloadBytes, LicensePayload.class);
            if (payload.getExpiresAt() == null) {
                throw new LicenseVerificationException("Payload de licence incomplet : date d'expiration absente");
            }
            return payload;
        } catch (LicenseVerificationException e) {
            throw e;
        } catch (Exception e) {
            throw new LicenseVerificationException("Impossible de vérifier la licence : " + e.getMessage(), e);
        }
    }

    public static KeyPair generateKeyPair() {
        try {
            KeyPairGenerator kpg = KeyPairGenerator.getInstance("Ed25519");
            return kpg.generateKeyPair();
        } catch (Exception e) {
            throw new IllegalStateException("Impossible de générer une paire de clés Ed25519", e);
        }
    }

    public static String encodePublicKey(PublicKey publicKey) {
        return Base64.getEncoder().encodeToString(publicKey.getEncoded());
    }

    public static String encodePrivateKey(PrivateKey privateKey) {
        return Base64.getEncoder().encodeToString(privateKey.getEncoded());
    }

    public static PublicKey decodePublicKey(String publicKeyBase64) {
        try {
            String cleaned = stripPemHeaders(publicKeyBase64);
            byte[] keyBytes = Base64.getDecoder().decode(cleaned);
            KeyFactory keyFactory = KeyFactory.getInstance("Ed25519");
            return keyFactory.generatePublic(new X509EncodedKeySpec(keyBytes));
        } catch (Exception e) {
            throw new LicenseVerificationException("Clé publique Ed25519 invalide : " + e.getMessage(), e);
        }
    }

    public static PrivateKey decodePrivateKey(String privateKeyBase64) {
        try {
            String cleaned = stripPemHeaders(privateKeyBase64);
            byte[] keyBytes = Base64.getDecoder().decode(cleaned);
            KeyFactory keyFactory = KeyFactory.getInstance("Ed25519");
            return keyFactory.generatePrivate(new PKCS8EncodedKeySpec(keyBytes));
        } catch (Exception e) {
            throw new LicenseVerificationException("Clé privée Ed25519 invalide : " + e.getMessage(), e);
        }
    }

    public static String sign(LicensePayload payload, PrivateKey privateKey) {
        try {
            byte[] payloadJson = OBJECT_MAPPER.writeValueAsBytes(payload);
            String payloadB64 = Base64.getUrlEncoder().withoutPadding().encodeToString(payloadJson);
            String signingPart = TOKEN_PREFIX + "." + payloadB64;

            Signature signer = Signature.getInstance("Ed25519");
            signer.initSign(privateKey);
            signer.update(signingPart.getBytes(StandardCharsets.UTF_8));
            byte[] sig = signer.sign();

            String sigB64 = Base64.getUrlEncoder().withoutPadding().encodeToString(sig);
            return signingPart + "." + sigB64;
        } catch (Exception e) {
            throw new IllegalStateException("Impossible de signer le jeton de licence", e);
        }
    }

    private static String stripPemHeaders(String key) {
        return key
                .replaceAll("-----BEGIN [A-Z ]+-----", "")
                .replaceAll("-----END [A-Z ]+-----", "")
                .replaceAll("\\s+", "");
    }
}
