package com.tarif.search.service.ai.batch;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service garantissant l'isolation stricte des recherches Batch par utilisateur.
 * Associe chaque batchId à l'identifiant Keycloak (sub) du créateur dans Redis (TTL 30 jours)
 * avec repli automatique en mémoire.
 */
@Service
@Slf4j
public class BatchOwnershipService {

    public record BatchOwnerRecord(
            String batchId,
            String ownerUserId,
            String endpoint,
            String zone,
            String submittedAt,
            Map<String, String> searchTerms
    ) {}

    private static final Duration BATCH_TTL = Duration.ofDays(30);
    private static final int MAX_BATCHES_PER_USER = 100;
    private static final String META_KEY_PREFIX = "tci:batch:meta:";
    private static final String USER_INDEX_PREFIX = "tci:batch:user:";

    private final ObjectProvider<StringRedisTemplate> redisTemplateProvider;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final Map<String, BatchOwnerRecord> fallbackMeta = new ConcurrentHashMap<>();
    private final Map<String, List<String>> fallbackUserIndex = new ConcurrentHashMap<>();

    @Autowired
    public BatchOwnershipService(ObjectProvider<StringRedisTemplate> redisTemplateProvider) {
        this.redisTemplateProvider = redisTemplateProvider;
    }

    public void registerBatch(
            String batchId,
            String ownerUserId,
            String endpoint,
            String zone,
            Map<String, String> searchTerms) {
        if (batchId == null || batchId.isBlank() || ownerUserId == null || ownerUserId.isBlank()) {
            return;
        }
        String cleanBatchId = batchId.trim();
        String cleanUserId = ownerUserId.trim();
        String normEndpoint = "positions10".equalsIgnoreCase(endpoint) ? "positions10" : "positions6";
        String normZone = "EU".equalsIgnoreCase(zone) ? "EU" : "DZ";
        Map<String, String> safeTerms = searchTerms != null ? new LinkedHashMap<>(searchTerms) : Collections.emptyMap();

        BatchOwnerRecord record = new BatchOwnerRecord(
                cleanBatchId,
                cleanUserId,
                normEndpoint,
                normZone,
                Instant.now().toString(),
                safeTerms
        );

        // Toujours maintenir le cache mémoire local en secours
        fallbackMeta.put(cleanBatchId, record);
        fallbackUserIndex.compute(cleanUserId, (k, existing) -> {
            List<String> updated = new ArrayList<>();
            updated.add(cleanBatchId);
            if (existing != null) {
                for (String id : existing) {
                    if (!cleanBatchId.equals(id) && updated.size() < MAX_BATCHES_PER_USER) {
                        updated.add(id);
                    }
                }
            }
            return Collections.unmodifiableList(updated);
        });

        StringRedisTemplate redis = getRedis();
        if (redis != null) {
            try {
                String metaJson = objectMapper.writeValueAsString(record);
                redis.opsForValue().set(META_KEY_PREFIX + cleanBatchId, metaJson, BATCH_TTL);

                List<String> currentIds = readUserIdsFromRedis(redis, cleanUserId);
                List<String> updatedIds = new ArrayList<>();
                updatedIds.add(cleanBatchId);
                for (String id : currentIds) {
                    if (!cleanBatchId.equals(id) && updatedIds.size() < MAX_BATCHES_PER_USER) {
                        updatedIds.add(id);
                    }
                }
                String indexJson = objectMapper.writeValueAsString(updatedIds);
                redis.opsForValue().set(USER_INDEX_PREFIX + cleanUserId, indexJson, BATCH_TTL);
            } catch (Exception e) {
                log.warn("Impossible d'enregistrer le batch {} dans Redis (repli mémoire actif): {}", cleanBatchId, e.getMessage());
            }
        }
    }

    public boolean isOwnedBy(String batchId, String userId) {
        if (batchId == null || batchId.isBlank() || userId == null || userId.isBlank()) {
            return false;
        }
        BatchOwnerRecord record = findBatch(batchId.trim());
        return record != null && userId.trim().equals(record.ownerUserId());
    }

    public BatchOwnerRecord findBatch(String batchId) {
        if (batchId == null || batchId.isBlank()) {
            return null;
        }
        String cleanBatchId = batchId.trim();
        StringRedisTemplate redis = getRedis();
        if (redis != null) {
            try {
                String json = redis.opsForValue().get(META_KEY_PREFIX + cleanBatchId);
                if (json != null && !json.isBlank()) {
                    return objectMapper.readValue(json, BatchOwnerRecord.class);
                }
            } catch (Exception e) {
                log.debug("Lecture Redis échouée pour batch {}: {}", cleanBatchId, e.getMessage());
            }
        }
        return fallbackMeta.get(cleanBatchId);
    }

    public List<BatchOwnerRecord> listUserBatches(String userId) {
        if (userId == null || userId.isBlank()) {
            return Collections.emptyList();
        }
        String cleanUserId = userId.trim();
        List<String> batchIds = null;

        StringRedisTemplate redis = getRedis();
        if (redis != null) {
            try {
                batchIds = readUserIdsFromRedis(redis, cleanUserId);
            } catch (Exception e) {
                log.debug("Lecture de l'index batch Redis échouée pour user {}: {}", cleanUserId, e.getMessage());
            }
        }
        if (batchIds == null || batchIds.isEmpty()) {
            batchIds = fallbackUserIndex.getOrDefault(cleanUserId, Collections.emptyList());
        }

        List<BatchOwnerRecord> records = new ArrayList<>();
        for (String id : batchIds) {
            BatchOwnerRecord rec = findBatch(id);
            if (rec != null && cleanUserId.equals(rec.ownerUserId())) {
                records.add(rec);
            }
        }
        return records;
    }

    private List<String> readUserIdsFromRedis(StringRedisTemplate redis, String userId) throws Exception {
        String raw = redis.opsForValue().get(USER_INDEX_PREFIX + userId);
        if (raw == null || raw.isBlank()) {
            return Collections.emptyList();
        }
        return objectMapper.readValue(raw, new TypeReference<List<String>>() {});
    }

    private StringRedisTemplate getRedis() {
        return redisTemplateProvider != null ? redisTemplateProvider.getIfAvailable() : null;
    }
}
