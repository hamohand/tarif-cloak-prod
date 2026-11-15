package com.tarif.search.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Gestionnaire de quota d'essai gratuit pour visiteurs anonymes :
 * - Par défaut 2 recherches IA / jour / IP et 100 recherches anonymes globales / jour.
 * - Utilise Redis si disponible, avec repli automatique en mémoire pour garantir la continuité.
 */
@Service
@Slf4j
public class GuestTrialService {

    public record TrialStatus(boolean allowed, int remaining, int limit, String reason) {}

    private static final Duration KEY_TTL = Duration.ofHours(25);

    private final ObjectProvider<StringRedisTemplate> redisTemplateProvider;
    private final int maxPerIpPerDay;
    private final int globalDailyLimit;
    private final Map<String, AtomicInteger> fallbackCounters = new ConcurrentHashMap<>();

    public GuestTrialService(
            ObjectProvider<StringRedisTemplate> redisTemplateProvider,
            @Value("${guest.trial.max-per-ip-per-day:2}") int maxPerIpPerDay,
            @Value("${guest.trial.global-daily-limit:100}") int globalDailyLimit) {
        this.redisTemplateProvider = redisTemplateProvider;
        this.maxPerIpPerDay = maxPerIpPerDay;
        this.globalDailyLimit = globalDailyLimit;
    }

    public TrialStatus peekStatus(String clientIp) {
        String ip = sanitizeIp(clientIp);
        String day = currentDayKey();
        int ipCount = readCounter(ipKey(day, ip));
        int globalCount = readCounter(globalKey(day));

        if (globalCount >= globalDailyLimit) {
            return new TrialStatus(false, 0, maxPerIpPerDay,
                    "Capacité quotidienne d'essai atteinte. Créez un compte gratuit pour continuer.");
        }
        int remaining = Math.max(0, maxPerIpPerDay - ipCount);
        if (remaining == 0) {
            return new TrialStatus(false, 0, maxPerIpPerDay,
                    "Essai gratuit épuisé (" + maxPerIpPerDay + " recherches par jour). Créez un compte gratuit pour continuer.");
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
                    "Capacité quotidienne d'essai atteinte. Créez un compte gratuit pour continuer.");
        }

        long ipCount = incrementCounter(ipKey(day, ip));
        if (ipCount > maxPerIpPerDay) {
            decrementCounterSafe(ipKey(day, ip));
            decrementCounterSafe(globalKey(day));
            return new TrialStatus(false, 0, maxPerIpPerDay,
                    "Essai gratuit épuisé (" + maxPerIpPerDay + " recherches par jour). Créez un compte gratuit pour continuer.");
        }

        int remaining = Math.max(0, (int) (maxPerIpPerDay - ipCount));
        return new TrialStatus(true, remaining, maxPerIpPerDay, null);
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
