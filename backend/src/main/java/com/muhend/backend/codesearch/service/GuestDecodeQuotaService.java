package com.muhend.backend.codesearch.service;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Quota découverte pour le décodage et la comparaison SQL des visiteurs non connectés :
 * - Par défaut 3 consultations / jour / IP et 500 consultations anonymes globales / jour.
 * - Gratuit et illimité dès que l'utilisateur est authentifié avec un compte entreprise/collaborateur.
 * - Exonère les appels d'enrichissement émis dans la foulée d'une recherche IA visiteur autorisée
 *   via le jeton HMAC-SHA256 court X-Guest-Search-Pass.
 */
@Service
@Slf4j
public class GuestDecodeQuotaService {

    public static final String GUEST_SEARCH_PASS_HEADER = "X-Guest-Search-Pass";
    public static final String GUEST_DECODE_REMAINING_HEADER = "X-Guest-Decode-Remaining";
    private static final long MAX_PASS_WINDOW_SECONDS = 300L;

    public record DecodeQuotaStatus(boolean allowed, int remaining, int limit, String reason) {}

    private final int maxPerIpPerDay;
    private final int globalDailyLimit;
    private final String passSecret;
    private final Map<String, AtomicInteger> counters = new ConcurrentHashMap<>();

    @Autowired
    public GuestDecodeQuotaService(
            @Value("${guest.decode.max-per-ip-per-day:3}") int maxPerIpPerDay,
            @Value("${guest.decode.global-daily-limit:500}") int globalDailyLimit,
            @Value("${spring.rabbitmq.password:admin}") String passSecret) {
        this.maxPerIpPerDay = maxPerIpPerDay;
        this.globalDailyLimit = globalDailyLimit;
        this.passSecret = (passSecret != null && !passSecret.isBlank()) ? passSecret : "admin";
    }

    public static boolean isAuthenticatedUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof Jwt;
    }

    public static String extractClientIp(HttpServletRequest request) {
        if (request == null) return "unknown";
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
    }

    public void enforceGuestAccess(HttpServletRequest request, HttpServletResponse response) {
        if (isAuthenticatedUser()) {
            return;
        }
        String clientIp = extractClientIp(request);
        String passHeader = request != null ? request.getHeader(GUEST_SEARCH_PASS_HEADER) : null;
        if (isValidEnrichmentPass(clientIp, passHeader)) {
            return;
        }
        DecodeQuotaStatus quota = tryConsumeDecode(clientIp);
        if (!quota.allowed()) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, quota.reason());
        }
        if (response != null) {
            response.setHeader(GUEST_DECODE_REMAINING_HEADER, String.valueOf(quota.remaining()));
        }
    }

    public DecodeQuotaStatus peekStatus(String clientIp) {
        String ip = sanitizeIp(clientIp);
        String day = currentDayKey();
        int ipCount = readCounter(ipKey(day, ip));
        int globalCount = readCounter(globalKey(day));

        if (globalCount >= globalDailyLimit) {
            return new DecodeQuotaStatus(false, 0, maxPerIpPerDay,
                    "Capacité quotidienne de découverte atteinte. Créez gratuitement votre compte entreprise ou connectez-vous pour accéder librement au décodage et à la comparaison.");
        }
        int remaining = Math.max(0, maxPerIpPerDay - ipCount);
        if (remaining == 0) {
            return new DecodeQuotaStatus(false, 0, maxPerIpPerDay, buildExhaustedMessage());
        }
        return new DecodeQuotaStatus(true, remaining, maxPerIpPerDay, null);
    }

    public DecodeQuotaStatus tryConsumeDecode(String clientIp) {
        String ip = sanitizeIp(clientIp);
        String day = currentDayKey();
        purgeOldDaysIfNeeded(day);

        int globalCount = counters.computeIfAbsent(globalKey(day), k -> new AtomicInteger(0)).incrementAndGet();
        if (globalCount > globalDailyLimit) {
            decrementCounterSafe(globalKey(day));
            return new DecodeQuotaStatus(false, 0, maxPerIpPerDay,
                    "Capacité quotidienne de découverte atteinte. Créez gratuitement votre compte entreprise ou connectez-vous pour accéder librement au décodage et à la comparaison.");
        }

        int ipCount = counters.computeIfAbsent(ipKey(day, ip), k -> new AtomicInteger(0)).incrementAndGet();
        if (ipCount > maxPerIpPerDay) {
            decrementCounterSafe(ipKey(day, ip));
            decrementCounterSafe(globalKey(day));
            return new DecodeQuotaStatus(false, 0, maxPerIpPerDay, buildExhaustedMessage());
        }

        int remaining = Math.max(0, maxPerIpPerDay - ipCount);
        return new DecodeQuotaStatus(true, remaining, maxPerIpPerDay, null);
    }

    public boolean isValidEnrichmentPass(String clientIp, String passHeader) {
        if (passHeader == null || passHeader.isBlank()) {
            return false;
        }
        String[] parts = passHeader.trim().split("\\.");
        if (parts.length != 2) {
            return false;
        }
        try {
            long exp = Long.parseLong(parts[0]);
            long now = Instant.now().getEpochSecond();
            if (now > exp || exp > now + MAX_PASS_WINDOW_SECONDS) {
                return false;
            }
            String expectedSig = hmacSha256Hex(sanitizeIp(clientIp) + ":" + exp, passSecret);
            byte[] expectedBytes = expectedSig.getBytes(StandardCharsets.US_ASCII);
            byte[] actualBytes = parts[1].trim().toLowerCase(Locale.ROOT).getBytes(StandardCharsets.US_ASCII);
            return MessageDigest.isEqual(expectedBytes, actualBytes);
        } catch (Exception e) {
            log.debug("Jeton X-Guest-Search-Pass invalide ignoré: {}", e.getMessage());
            return false;
        }
    }

    private String buildExhaustedMessage() {
        return "Aperçu découverte épuisé (" + maxPerIpPerDay
                + " consultations sans compte). Créez gratuitement votre compte entreprise ou connectez-vous pour accéder librement et sans limite au décodage et à la comparaison.";
    }

    private int readCounter(String key) {
        AtomicInteger counter = counters.get(key);
        return counter != null ? Math.max(0, counter.get()) : 0;
    }

    private void decrementCounterSafe(String key) {
        AtomicInteger counter = counters.get(key);
        if (counter != null) {
            counter.updateAndGet(v -> Math.max(0, v - 1));
        }
    }

    private void purgeOldDaysIfNeeded(String day) {
        if (counters.size() <= 5_000) {
            return;
        }
        String todayPrefix = "guest_decode:" + day + ":";
        counters.keySet().removeIf(k -> !k.startsWith(todayPrefix));
    }

    private static String hmacSha256Hex(String payload, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] digest = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(digest);
    }

    private static String currentDayKey() {
        return LocalDate.now(ZoneOffset.UTC).toString();
    }

    private static String ipKey(String day, String ip) {
        return "guest_decode:" + day + ":ip:" + ip;
    }

    private static String globalKey(String day) {
        return "guest_decode:" + day + ":global";
    }

    private static String sanitizeIp(String clientIp) {
        if (clientIp == null || clientIp.isBlank()) {
            return "unknown";
        }
        return clientIp.trim();
    }
}
