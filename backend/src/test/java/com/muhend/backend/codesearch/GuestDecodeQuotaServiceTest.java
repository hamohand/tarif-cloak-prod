package com.muhend.backend.codesearch;

import com.muhend.backend.codesearch.service.GuestDecodeQuotaService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HexFormat;

import static org.junit.jupiter.api.Assertions.*;

class GuestDecodeQuotaServiceTest {

    @Test
    void anonymousIpAllowedThreeTimesThenBlockedWithClearMessage() {
        GuestDecodeQuotaService service = new GuestDecodeQuotaService(3, 50, "unit-test-secret");

        var initial = service.peekStatus("198.51.100.10");
        assertTrue(initial.allowed());
        assertEquals(3, initial.remaining());

        assertEquals(2, service.tryConsumeDecode("198.51.100.10").remaining());
        assertEquals(1, service.tryConsumeDecode("198.51.100.10").remaining());
        var third = service.tryConsumeDecode("198.51.100.10");
        assertTrue(third.allowed());
        assertEquals(0, third.remaining());

        var fourth = service.tryConsumeDecode("198.51.100.10");
        assertFalse(fourth.allowed());
        assertEquals(0, fourth.remaining());
        assertTrue(fourth.reason().startsWith("Aperçu découverte épuisé"));

        var afterPeek = service.peekStatus("198.51.100.10");
        assertFalse(afterPeek.allowed());
        assertEquals(0, afterPeek.remaining());
    }

    @Test
    void globalDailyLimitStopsAdditionalAnonymousIps() {
        GuestDecodeQuotaService service = new GuestDecodeQuotaService(3, 2, "unit-test-secret");

        assertTrue(service.tryConsumeDecode("198.51.100.1").allowed());
        assertTrue(service.tryConsumeDecode("198.51.100.2").allowed());

        var blocked = service.tryConsumeDecode("198.51.100.3");
        assertFalse(blocked.allowed());
        assertEquals(0, blocked.remaining());
    }

    @Test
    void enrichmentPassValidatesMatchingIpAndRejectsTamperedExpiredOrWrongIp() throws Exception {
        String secret = "unit-test-secret";
        GuestDecodeQuotaService service = new GuestDecodeQuotaService(3, 50, secret);
        String clientIp = "203.0.113.42";

        long futureExp = Instant.now().getEpochSecond() + 120;
        String validPass = signPass(clientIp, futureExp, secret);
        assertTrue(service.isValidEnrichmentPass(clientIp, validPass));
        assertFalse(service.isValidEnrichmentPass("203.0.113.99", validPass));

        long pastExp = Instant.now().getEpochSecond() - 10;
        assertFalse(service.isValidEnrichmentPass(clientIp, signPass(clientIp, pastExp, secret)));

        assertFalse(service.isValidEnrichmentPass(clientIp, futureExp + ".deadbeef"));
        assertFalse(service.isValidEnrichmentPass(clientIp, "malformed"));
        assertFalse(service.isValidEnrichmentPass(clientIp, null));
    }

    @Test
    void enforceGuestAccessSetsHeaderForGuestsAndBypassesForJwtAuthenticatedUsers() {
        GuestDecodeQuotaService service = new GuestDecodeQuotaService(1, 10, "unit-test-secret");

        try {
            SecurityContextHolder.clearContext();
            MockHttpServletRequest req = new MockHttpServletRequest();
            req.addHeader("X-Forwarded-For", "192.0.2.5");
            MockHttpServletResponse resp = new MockHttpServletResponse();

            service.enforceGuestAccess(req, resp);
            assertEquals("0", resp.getHeader(GuestDecodeQuotaService.GUEST_DECODE_REMAINING_HEADER));

            ResponseStatusException blocked = assertThrows(ResponseStatusException.class,
                    () -> service.enforceGuestAccess(req, new MockHttpServletResponse()));
            assertEquals(HttpStatus.TOO_MANY_REQUESTS, blocked.getStatusCode());

            // Connecté avec JWT : accès illimité sans consommer le quota invité
            Jwt jwt = Jwt.withTokenValue("tok")
                    .header("alg", "none")
                    .claim("sub", "user-123")
                    .build();
            SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(jwt, null));
            MockHttpServletResponse authedResp = new MockHttpServletResponse();
            assertDoesNotThrow(() -> service.enforceGuestAccess(req, authedResp));
            assertNull(authedResp.getHeader(GuestDecodeQuotaService.GUEST_DECODE_REMAINING_HEADER));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private static String signPass(String ip, long exp, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] digest = mac.doFinal((ip + ":" + exp).getBytes(StandardCharsets.UTF_8));
        return exp + "." + HexFormat.of().formatHex(digest);
    }
}
