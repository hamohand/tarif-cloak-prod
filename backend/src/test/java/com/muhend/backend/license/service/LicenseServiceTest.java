package com.muhend.backend.license.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.muhend.backend.license.dto.LicensePayload;
import com.muhend.backend.license.dto.LicenseStatusDto;
import com.muhend.backend.license.model.OnPremLicenseState;
import com.muhend.backend.license.repository.OnPremLicenseStateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.security.KeyPair;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LicenseServiceTest {

    @Mock
    private OnPremLicenseStateRepository repository;

    private final Ed25519LicenseVerifier verifier = new Ed25519LicenseVerifier();
    private KeyPair keyPair;
    private String publicKeyB64;
    private Clock fixedClock;

    @BeforeEach
    void setUp() {
        keyPair = Ed25519LicenseVerifier.generateKeyPair();
        publicKeyB64 = Ed25519LicenseVerifier.encodePublicKey(keyPair.getPublic());
        fixedClock = Clock.fixed(Instant.parse("2026-11-16T10:00:00Z"), ZoneOffset.UTC);

        lenient().when(repository.save(any(OnPremLicenseState.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void validToken_shouldReturnValid() {
        String token = signToken("LIC-1", "box-dz-01", LocalDate.of(2027, 1, 1), 30);
        when(repository.findById(1L)).thenReturn(Optional.of(baseState(token, LocalDateTime.of(2026, 11, 16, 9, 0))));

        LicenseService service = buildService("box-dz-01", "");
        LicenseStatusDto status = service.getCurrentStatus();

        assertTrue(status.isValid());
        assertEquals("VALID", status.getState());
        assertEquals("LIC-1", status.getLicenseId());
    }

    @Test
    void expiredWithinGracePeriod_shouldRemainValidInGracePeriod() {
        // Expirée il y a 10 jours, grâce de 30 jours => valide en GRACE_PERIOD
        String token = signToken("LIC-2", "box-dz-01", LocalDate.of(2026, 11, 6), 30);
        when(repository.findById(1L)).thenReturn(Optional.of(baseState(token, LocalDateTime.of(2026, 11, 16, 9, 0))));

        LicenseService service = buildService("box-dz-01", "");
        LicenseStatusDto status = service.getCurrentStatus();

        assertTrue(status.isValid());
        assertEquals("GRACE_PERIOD", status.getState());
        assertEquals(20L, status.getOfflineGraceDaysRemaining());
    }

    @Test
    void expiredBeyondGracePeriod_shouldReturnExpiredInvalid() {
        String token = signToken("LIC-3", "box-dz-01", LocalDate.of(2026, 10, 1), 30);
        when(repository.findById(1L)).thenReturn(Optional.of(baseState(token, LocalDateTime.of(2026, 11, 16, 9, 0))));

        LicenseService service = buildService("box-dz-01", "");
        LicenseStatusDto status = service.getCurrentStatus();

        assertFalse(status.isValid());
        assertEquals("EXPIRED", status.getState());
    }

    @Test
    void boxIdMismatch_shouldReturnBoxMismatch() {
        String token = signToken("LIC-4", "box-other", LocalDate.of(2027, 1, 1), 30);
        when(repository.findById(1L)).thenReturn(Optional.of(baseState(token, LocalDateTime.of(2026, 11, 16, 9, 0))));

        LicenseService service = buildService("box-dz-01", "");
        LicenseStatusDto status = service.getCurrentStatus();

        assertFalse(status.isValid());
        assertEquals("BOX_MISMATCH", status.getState());
    }

    @Test
    void clockRollback_shouldReturnClockTampered() {
        String token = signToken("LIC-5", "box-dz-01", LocalDate.of(2027, 1, 1), 30);
        // lastSeenAt est 10 jours dans le futur par rapport à fixedClock (2026-11-16)
        when(repository.findById(1L)).thenReturn(Optional.of(baseState(token, LocalDateTime.of(2026, 11, 26, 10, 0))));

        LicenseService service = buildService("box-dz-01", "");
        LicenseStatusDto status = service.getCurrentStatus();

        assertFalse(status.isValid());
        assertEquals("CLOCK_TAMPERED", status.getState());
    }

    @Test
    void activateLicense_withInvalidSignature_shouldThrowIllegalArgumentException() {
        LicenseService service = buildService("box-dz-01", "");
        assertThrows(IllegalArgumentException.class, () -> service.activateLicense("TCI1.invalid.sig"));
    }

    private LicenseService buildService(String boxId, String configuredToken) {
        return new LicenseService(
                repository,
                verifier,
                new ObjectMapper(),
                fixedClock,
                boxId,
                publicKeyB64,
                configuredToken,
                "",
                "",
                30
        );
    }

    private String signToken(String licenseId, String boxId, LocalDate expiresAt, int graceDays) {
        LicensePayload payload = LicensePayload.builder()
                .licenseId(licenseId)
                .boxId(boxId)
                .organizationName("Client Test DZ")
                .planName("Box Standard")
                .maxUsers(15)
                .monthlyQuota(null)
                .issuedAt(LocalDate.of(2026, 1, 1))
                .expiresAt(expiresAt)
                .graceDays(graceDays)
                .build();
        return Ed25519LicenseVerifier.sign(payload, keyPair.getPrivate());
    }

    private OnPremLicenseState baseState(String token, LocalDateTime lastSeenAt) {
        return new OnPremLicenseState(1L, "LIC", "box-dz-01", token, false, lastSeenAt, null, lastSeenAt);
    }
}
