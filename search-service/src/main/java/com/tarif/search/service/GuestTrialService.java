package com.tarif.search.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Gestionnaire de quota d'essai gratuit pour visiteurs anonymes :
 * - Par défaut 1 recherche IA / jour / IP et 100 recherches anonymes globales / jour.
 * - Utilise Redis si disponible, avec repli automatique en mémoire pour garantir la continuité.
 */
@Service
@Slf4j
public class GuestTrialService {

    public record TrialStatus(boolean allowed, int remaining, int limit, String reason) {}

    private static final Duration KEY_TTL = Duration.ofHours(25);
    private static final long PASS_TTL_SECONDS = 120L;

    private final ObjectProvider<StringRedisTemplate> redisTemplateProvider;
    private final int maxPerIpPerDay;
    private final int globalDailyLimit;
    private final String passSecret;
    private final Map<String, AtomicInteger> fallbackCounters = new ConcurrentHashMap<>();

    public GuestTrialService(
            ObjectProvider<StringRedisTemplate> redisTemplateProvider,
            int maxPerIpPerDay,
            int globalDailyLimit) {
        this(redisTemplateProvider, maxPerIpPerDay, globalDailyLimit, "test-secret");
    }

    @Autowired
    public GuestTrialService(
            ObjectProvider<StringRedisTemplate> redisTemplateProvider,
            @Value("${guest.trial.max-per-ip-per-day:1}") int maxPerIpPerDay,
            @Value("${guest.trial.global-daily-limit:100}") int globalDailyLimit,
            @Value("${spring.rabbitmq.password:admin}") String passSecret) {
        this.redisTemplateProvider = redisTemplateProvider;
        this.maxPerIpPerDay = maxPerIpPerDay;
        this.globalDailyLimit = globalDailyLimit;
        this.passSecret = (passSecret != null && !passSecret.isBlank()) ? passSecret : "admin";
    }

    public TrialStatus peekStatus(String clientIp) {
        String ip = sanitizeIp(clientIp);
        String day = currentDayKey();
        int ipCount = readCounter(ipKey(day, ip));
        int globalCount = readCounter(globalKey(day));

        if (globalCount >= globalDailyLimit) {
            return new TrialStatus(false, 0, maxPerIpPerDay,
                    "Capacité quotidienne d'essai atteinte. Créez gratuitement votre compte entreprise pour continuer.");
        }
        int remaining = Math.max(0, maxPerIpPerDay - ipCount);
        if (remaining == 0) {
            return new TrialStatus(false, 0, maxPerIpPerDay, buildExhaustedMessage());
        }
        return new TrialStatus(true, remaining, maxPerIpPerDay, null);
    }

    public TrialStatus tryConsumeTrial(String clientIp) {
        String ip = sanitizeIp(clientIp);
        String day = currentDayKey();

        long globalCount = incrementCounter(globalKey(day));
        if (globalCount > globalDailyLimit) {
            decrementCounterSafe(globalKey(day));
            return new TrialStatus(false, 0, maxPerIpPerDay,
                    "Capacité quotidienne d'essai atteinte. Créez gratuitement votre compte entreprise pour continuer.");
        }

        long ipCount = incrementCounter(ipKey(day, ip));
        if (ipCount > maxPerIpPerDay) {
            decrementCounterSafe(ipKey(day, ip));
            decrementCounterSafe(globalKey(day));
            return new TrialStatus(false, 0, maxPerIpPerDay, buildExhaustedMessage());
        }

        int remaining = Math.max(0, (int) (maxPerIpPerDay - ipCount));
        return new TrialStatus(true, remaining, maxPerIpPerDay, null);
    }

    public String issueEnrichmentPass(String clientIp) {
        long exp = Instant.now().getEpochSecond() + PASS_TTL_SECONDS;
        String payload = sanitizeIp(clientIp) + ":" + exp;
        return exp + "." + hmacSha256Hex(payload, passSecret);
    }

    private String buildExhaustedMessage() {
        return "Essai gratuit épuisé (" + maxPerIpPerDay
                + (maxPerIpPerDay > 1 ? " recherches" : " recherche")
                + " découverte sans compte). Créez gratuitement votre compte entreprise pour continuer.";
    }

    private static String hmacSha256Hex(String payload, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new IllegalStateException("Impossible de signer le jeton d'enrichissement", e);
        }
    }

    private int readCounter(String key) {
        StringRedisTemplate redis = redisTemplateProvider.getIfAvailable();
        if (redis != null) {
            try {
                String val = redis.opsForValue().get(key);
                return val != null ? Integer.parseInt(val) : 0;
            } catch (Exception e) {
                log.debug("Redis indisponible pour lecture quota invité ({}), repli mémoire", e.getMessage());
            }
        }
        AtomicInteger local = fallbackCounters.get(key);
        return local != null ? Math.max(0, local.get()) : 0;
    }

    private long incrementCounter(String key) {
        StringRedisTemplate redis = redisTemplateProvider.getIfAvailable();
        if (redis != null) {
            try {
                Long val = redis.opsForValue().increment(key);
                if (val != null) {
                    if (val == 1L) {
                        redis.expire(key, KEY_TTL);
                    }
                    return val;
                }
            } catch (Exception e) {
                log.debug("Redis indisponible pour incrément quota invité ({}), repli mémoire", e.getMessage());
            }
        }
        purgeOldDaysIfNeeded();
        return fallbackCounters.computeIfAbsent(key, k -> new AtomicInteger(0)).incrementAndGet();
    }

    private void decrementCounterSafe(String key) {
        StringRedisTemplate redis = redisTemplateProvider.getIfAvailable();
        if (redis != null) {
            try {
                redis.opsForValue().decrement(key);
                return;
            } catch (Exception e) {
                log.debug("Redis indisponible pour décrément quota invité: {}", e.getMessage());
            }
        }
        AtomicInteger local = fallbackCounters.get(key);
        if (local != null) {
            local.updateAndGet(v -> Math.max(0, v - 1));
        }
    }

    private void purgeOldDaysIfNeeded() {
        if (fallbackCounters.size() <= 5_000) return;
        String todayPrefix = "guest_trial:" + currentDayKey() + ":";
        fallbackCounters.keySet().removeIf(k -> !k.startsWith(todayPrefix));
    }

    private static String currentDayKey() {
        return LocalDate.now(ZoneOffset.UTC).toString();
    }

    private static String ipKey(String day, String ip) {
        return "guest_trial:" + day + ":ip:" + ip;
    }

    private static String globalKey(String day) {
        return "guest_trial:" + day + ":global";
    }

    private static String sanitizeIp(String clientIp) {
        if (clientIp == null || clientIp.isBlank()) {
            return "unknown";
        }
        return clientIp.trim();
    }
}
