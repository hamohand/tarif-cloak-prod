package com.muhend.backend.license.service;

import com.muhend.backend.license.dto.LicensePayload;
import com.muhend.backend.license.service.Ed25519LicenseVerifier.LicenseVerificationException;
import org.junit.jupiter.api.Test;

import java.security.KeyPair;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class Ed25519LicenseVerifierTest {

    private final Ed25519LicenseVerifier verifier = new Ed25519LicenseVerifier();

    @Test
    void verifyAndParse_withValidToken_shouldReturnPayload() {
        KeyPair kp = Ed25519LicenseVerifier.generateKeyPair();
        String pubB64 = Ed25519LicenseVerifier.encodePublicKey(kp.getPublic());

        LicensePayload payload = LicensePayload.builder()
                .licenseId("LIC-DZ-001")
                .boxId("box-client-01")
                .organizationName("Transitaire Alger SARL")
                .planName("Box Enterprise")
                .maxUsers(25)
                .monthlyQuota(null)
                .issuedAt(LocalDate.of(2026, 11, 1))
                .expiresAt(LocalDate.of(2027, 11, 1))
                .graceDays(30)
                .build();

        String token = Ed25519LicenseVerifier.sign(payload, kp.getPrivate());
        assertTrue(token.startsWith("TCI1."));

        LicensePayload parsed = verifier.verifyAndParse("  " + token + "\n", pubB64);
        assertEquals("LIC-DZ-001", parsed.getLicenseId());
        assertEquals("box-client-01", parsed.getBoxId());
        assertEquals("Transitaire Alger SARL", parsed.getOrganizationName());
        assertEquals(25, parsed.getMaxUsers());
        assertEquals(LocalDate.of(2027, 11, 1), parsed.getExpiresAt());
    }

    @Test
    void verifyAndParse_withTamperedPayload_shouldThrow() {
        KeyPair kp = Ed25519LicenseVerifier.generateKeyPair();
        String pubB64 = Ed25519LicenseVerifier.encodePublicKey(kp.getPublic());

        LicensePayload payload = LicensePayload.builder()
                .licenseId("LIC-001")
                .boxId("box-1")
                .expiresAt(LocalDate.of(2027, 1, 1))
                .build();

        String token = Ed25519LicenseVerifier.sign(payload, kp.getPrivate());
        String[] parts = token.split("\\.");
        // Altérer le payload Base64Url
        String tamperedToken = parts[0] + "." + parts[1].substring(0, parts[1].length() - 2) + "AA." + parts[2];

        assertThrows(LicenseVerificationException.class, () -> verifier.verifyAndParse(tamperedToken, pubB64));
    }

    @Test
    void verifyAndParse_withWrongPublicKey_shouldThrow() {
        KeyPair kp1 = Ed25519LicenseVerifier.generateKeyPair();
        KeyPair kp2 = Ed25519LicenseVerifier.generateKeyPair();
        String wrongPubB64 = Ed25519LicenseVerifier.encodePublicKey(kp2.getPublic());

        LicensePayload payload = LicensePayload.builder()
                .licenseId("LIC-002")
                .boxId("box-1")
                .expiresAt(LocalDate.of(2027, 1, 1))
                .build();

        String token = Ed25519LicenseVerifier.sign(payload, kp1.getPrivate());
        assertThrows(LicenseVerificationException.class, () -> verifier.verifyAndParse(token, wrongPubB64));
    }
}
