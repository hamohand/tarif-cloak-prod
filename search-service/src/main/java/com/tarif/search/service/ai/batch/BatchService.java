package com.tarif.search.service.ai.batch;

import com.tarif.search.service.ai.batch.models.BatchResult;
import com.tarif.search.service.ai.batch.models.BatchStatus;
import com.tarif.search.service.ai.batch.models.SearchRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Service orchestrateur pour les opérations batch.
 * Route les requêtes vers le provider approprié selon la configuration ai.provider.
 * Réplique le pattern de AiService pour la couche batch.
 */
@Service
@Slf4j
public class BatchService {

    private final AnthropicBatchProvider anthropicBatchProvider;
    private final OpenAiBatchProvider openAiBatchProvider;
    private final String activeProvider;

    public BatchService(
            AnthropicBatchProvider anthropicBatchProvider,
            OpenAiBatchProvider openAiBatchProvider,
            @Value("${ai.provider:openai}") String activeProvider) {
        this.anthropicBatchProvider = anthropicBatchProvider;
        this.openAiBatchProvider = openAiBatchProvider;
        this.activeProvider = activeProvider;

        log.info("BatchService initialisé avec provider: {}", activeProvider);

        if (!getActiveProvider().supportsBatching()) {
            log.warn("Provider {} ne supporte pas les opérations batch", activeProvider);
        }
    }

    public String createBatch(List<SearchRequest> requests) {
        validateBatchingSupport();
        return getActiveProvider().createBatch(requests);
    }

    public BatchStatus getBatchStatus(String batchId) {
        validateBatchingSupport();
        return getActiveProvider().getBatchStatus(batchId);
    }

    public List<BatchResult> getBatchResults(String batchId) {
        validateBatchingSupport();
        return getActiveProvider().getBatchResults(batchId);
    }

    public boolean cancelBatch(String batchId) {
        validateBatchingSupport();
        return getActiveProvider().cancelBatch(batchId);
    }

    private BatchProvider getActiveProvider() {
        return switch (activeProvider.toLowerCase()) {
            case "anthropic" -> anthropicBatchProvider;
            case "openai" -> openAiBatchProvider;
            default -> throw new UnsupportedOperationException(
                "Provider " + activeProvider + " ne supporte pas les opérations batch"
            );
        };
    }

    private void validateBatchingSupport() {
        BatchProvider provider = getActiveProvider();
        if (!provider.supportsBatching()) {
            throw new UnsupportedOperationException(
                "Provider " + activeProvider + " ne supporte pas les opérations batch"
            );
        }
    }

    public String getActiveProviderName() {
        return activeProvider;
    }
}
