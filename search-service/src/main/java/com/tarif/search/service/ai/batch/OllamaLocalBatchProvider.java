package com.tarif.search.service.ai.batch;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tarif.search.model.Position;
import com.tarif.search.model.UsageInfo;
import com.tarif.search.service.SearchService;
import com.tarif.search.service.SearchService.SearchLevel;
import com.tarif.search.service.ai.AiPrompts;
import com.tarif.search.service.ai.JsonUtils;
import com.tarif.search.service.ai.OllamaService;
import com.tarif.search.service.ai.batch.models.BatchResult;
import com.tarif.search.service.ai.batch.models.BatchStatus;
import com.tarif.search.service.ai.batch.models.SearchRequest;
import jakarta.annotation.PreDestroy;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Provider de traitement par lots (Batch) 100 % local pour Ollama.
 * Exécute les recherches de manière asynchrone sur le GPU local via une file bornée
 * et persiste l'état/les résultats dans Redis (si disponible) avec fallback mémoire.
 */
@Service
@Slf4j
public class OllamaLocalBatchProvider implements BatchProvider {

    private static final String REDIS_KEY_PREFIX = "tci:local-batch:";

    private final SearchService searchService;
    private final OllamaService ollamaService;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redisTemplate;
    private final int maxRequests;
    private final SearchLevel defaultLevel;
    private final long ttlHours;
    private final ExecutorService executorService;
    private final Map<String, LocalBatchJob> jobs = new ConcurrentHashMap<>();

    public OllamaLocalBatchProvider(
            SearchService searchService,
            OllamaService ollamaService) {
        this(searchService, ollamaService, new ObjectMapper(), null, 300, 1, "POSITIONS10", 168L);
    }

    @Autowired
    public OllamaLocalBatchProvider(
            SearchService searchService,
            OllamaService ollamaService,
            @Nullable ObjectMapper objectMapper,
            @Nullable StringRedisTemplate redisTemplate,
            @Value("${ai.batch.local-max-requests:300}") int maxRequests,
            @Value("${ai.batch.local-concurrency:1}") int concurrency,
            @Value("${ai.batch.local-level:POSITIONS10}") String defaultLevel,
            @Value("${ai.batch.local-ttl-hours:168}") long ttlHours) {
        this.searchService = searchService;
        this.ollamaService = ollamaService;
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
        this.redisTemplate = redisTemplate;
        this.maxRequests = maxRequests;
        this.defaultLevel = parseSearchLevel(defaultLevel);
        this.ttlHours = ttlHours;
        int workers = Math.max(1, concurrency);
        this.executorService = Executors.newFixedThreadPool(workers, r -> {
            Thread t = new Thread(r, "ollama-local-batch-worker");
            t.setDaemon(true);
            return t;
        });
        log.info("OllamaLocalBatchProvider initialisé (maxRequests={}, concurrency={}, level={}, redis={})",
                this.maxRequests, workers, this.defaultLevel, this.redisTemplate != null);
    }

    private SearchLevel parseSearchLevel(String levelStr) {
        if (levelStr == null || levelStr.isBlank()) {
            return SearchLevel.POSITIONS10;
        }
        try {
            return SearchLevel.valueOf(levelStr.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            log.warn("Niveau batch local inconnu '{}', utilisation de POSITIONS10", levelStr);
            return SearchLevel.POSITIONS10;
        }
    }

    public int getMaxRequests() {
        return maxRequests;
    }

    @Override
    public String createBatch(List<SearchRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            log.error("Liste de requêtes batch vide");
            return null;
        }
        if (requests.size() > maxRequests) {
            throw new IllegalArgumentException(
                    "Maximum " + maxRequests + " recherches par batch en mode local");
        }

        String batchId = "local-batch-" + UUID.randomUUID();
        LocalBatchJob job = new LocalBatchJob();
        job.setId(batchId);
        job.setProcessingStatus("in_progress");
        job.setCreatedAt(Instant.now().toString());
        job.setProcessing(requests.size());
        job.setSucceeded(0);
        job.setErrored(0);
        job.setCanceled(0);
        job.setExpired(0);
        job.setCancelRequested(false);
        job.setResults(new ArrayList<>());

        jobs.put(batchId, job);
        persistJob(job);

        for (int i = 0; i < requests.size(); i++) {
            final int index = i;
            final SearchRequest req = requests.get(i);
            executorService.submit(() -> processItem(job, req, index));
        }

        log.info("Batch local créé: {} ({} requêtes)", batchId, requests.size());
        return batchId;
    }

    private void processItem(LocalBatchJob job, SearchRequest req, int index) {
        String customId = req.getCustomId() != null && !req.getCustomId().isBlank()
                ? req.getCustomId()
                : "search-" + index;

        if (job.isCancelRequested()) {
            recordResult(job, LocalBatchResult.canceled(customId), ItemOutcome.CANCELED);
            return;
        }

        try {
            List<Position> positions;
            if (req.getRagContext() != null && req.getRagContext().contains("- Code = ")) {
                String prompt = AiPrompts.buildUserPrompt(req.getRagContext(), req.getSearchTerm());
                String raw = ollamaService.demanderAiAide("POSITIONS6", prompt, true, "POSITIONS6");
                String cleaned = JsonUtils.cleanJsonString(raw);
                positions = JsonUtils.conversionReponseIaToList(cleaned);
            } else {
                positions = searchService.search(req.getSearchTerm(), defaultLevel);
            }

            if (positions == null) {
                positions = Collections.emptyList();
            }
            String jsonContent = objectMapper.writeValueAsString(positions);
            UsageInfo usage = ollamaService.getLastUsageInfo();
            int inputTokens = usage != null ? usage.getPromptTokens() : 0;
            int outputTokens = usage != null ? usage.getCompletionTokens() : 0;

            LocalBatchResult result = new LocalBatchResult(
                    customId,
                    "succeeded",
                    jsonContent,
                    inputTokens,
                    outputTokens,
                    null,
                    null,
                    "ollama"
            );
            recordResult(job, result, ItemOutcome.SUCCEEDED);

        } catch (Exception e) {
            log.warn("Erreur traitement item batch local {} ({}): {}", job.getId(), customId, e.getMessage());
            LocalBatchResult result = new LocalBatchResult(
                    customId,
                    "errored",
                    null,
                    0,
                    0,
                    e.getClass().getSimpleName(),
                    e.getMessage(),
                    "ollama"
            );
            recordResult(job, result, ItemOutcome.ERRORED);
        } finally {
            ollamaService.clearUsageInfo();
        }
    }

    private void recordResult(LocalBatchJob job, LocalBatchResult result, ItemOutcome outcome) {
        synchronized (job) {
            job.getResults().add(result);
            job.setProcessing(Math.max(0, job.getProcessing() - 1));
            switch (outcome) {
                case SUCCEEDED -> job.setSucceeded(job.getSucceeded() + 1);
                case ERRORED -> job.setErrored(job.getErrored() + 1);
                case CANCELED -> job.setCanceled(job.getCanceled() + 1);
            }
            if (job.getProcessing() == 0) {
                job.setProcessingStatus("ended");
                job.setEndedAt(Instant.now().toString());
                job.setResultsUrl("local://batches/" + job.getId());
                log.info("Batch local terminé: {} (succès={}, erreurs={}, annulés={})",
                        job.getId(), job.getSucceeded(), job.getErrored(), job.getCanceled());
            }
            persistJob(job);
        }
    }

    @Override
    public BatchStatus getBatchStatus(String batchId) {
        LocalBatchJob job = findJob(batchId);
        if (job == null) {
            return null;
        }
        synchronized (job) {
            Map<String, Integer> counts = new LinkedHashMap<>();
            counts.put("processing", job.getProcessing());
            counts.put("succeeded", job.getSucceeded());
            counts.put("errored", job.getErrored());
            counts.put("canceled", job.getCanceled());
            counts.put("expired", job.getExpired());

            return BatchStatus.builder()
                    .id(job.getId())
                    .processingStatus(job.getProcessingStatus())
                    .requestCounts(counts)
                    .createdAt(job.getCreatedAt())
                    .endedAt(job.getEndedAt())
                    .resultsUrl(job.getResultsUrl())
                    .provider("ollama")
                    .build();
        }
    }

    @Override
    public List<BatchResult> getBatchResults(String batchId) {
        LocalBatchJob job = findJob(batchId);
        if (job == null) {
            return null;
        }
        synchronized (job) {
            if (!"ended".equals(job.getProcessingStatus())) {
                return Collections.emptyList();
            }
            List<BatchResult> out = new ArrayList<>(job.getResults().size());
            for (LocalBatchResult item : job.getResults()) {
                out.add(BatchResult.builder()
                        .customId(item.getCustomId())
                        .resultType(item.getResultType())
                        .content(item.getContent())
                        .inputTokens(item.getInputTokens())
                        .outputTokens(item.getOutputTokens())
                        .errorType(item.getErrorType())
                        .errorMessage(item.getErrorMessage())
                        .provider(item.getProvider())
                        .build());
            }
            return out;
        }
    }

    @Override
    public boolean cancelBatch(String batchId) {
        LocalBatchJob job = findJob(batchId);
        if (job == null) {
            return false;
        }
        synchronized (job) {
            if ("ended".equals(job.getProcessingStatus())) {
                return false;
            }
            job.setCancelRequested(true);
            persistJob(job);
            log.info("Annulation demandée pour le batch local: {}", batchId);
            return true;
        }
    }

    private LocalBatchJob findJob(String batchId) {
        if (batchId == null || batchId.isBlank()) {
            return null;
        }
        LocalBatchJob job = jobs.get(batchId);
        if (job != null) {
            return job;
        }
        if (redisTemplate != null) {
            try {
                String json = redisTemplate.opsForValue().get(REDIS_KEY_PREFIX + batchId);
                if (json != null && !json.isBlank()) {
                    LocalBatchJob loaded = objectMapper.readValue(json, LocalBatchJob.class);
                    jobs.putIfAbsent(batchId, loaded);
                    return jobs.get(batchId);
                }
            } catch (Exception e) {
                log.warn("Impossible de relire le batch local {} depuis Redis: {}", batchId, e.getMessage());
            }
        }
        return null;
    }

    private void persistJob(LocalBatchJob job) {
        if (redisTemplate == null) {
            return;
        }
        try {
            String json = objectMapper.writeValueAsString(job);
            redisTemplate.opsForValue().set(
                    REDIS_KEY_PREFIX + job.getId(),
                    json,
                    Duration.ofHours(ttlHours)
            );
        } catch (Exception e) {
            log.warn("Impossible de persister le batch local {} dans Redis: {}", job.getId(), e.getMessage());
        }
    }

    @PreDestroy
    public void shutdown() {
        executorService.shutdownNow();
    }

    private enum ItemOutcome {
        SUCCEEDED, ERRORED, CANCELED
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    static class LocalBatchJob {
        private String id;
        private String processingStatus;
        private String createdAt;
        private String endedAt;
        private String resultsUrl;
        private int processing;
        private int succeeded;
        private int errored;
        private int canceled;
        private int expired;
        private boolean cancelRequested;
        private List<LocalBatchResult> results = new ArrayList<>();
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    static class LocalBatchResult {
        private String customId;
        private String resultType;
        private String content;
        private Integer inputTokens;
        private Integer outputTokens;
        private String errorType;
        private String errorMessage;
        private String provider;

        static LocalBatchResult canceled(String customId) {
            return new LocalBatchResult(customId, "canceled", null, 0, 0,
                    "Canceled", "Batch annulé par l'utilisateur", "ollama");
        }
    }
}
