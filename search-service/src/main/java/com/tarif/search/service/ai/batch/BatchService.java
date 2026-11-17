package com.tarif.search.service.ai.batch;

import com.tarif.search.service.ai.batch.models.BatchResult;
import com.tarif.search.service.ai.batch.models.BatchStatus;
import com.tarif.search.service.ai.batch.models.SearchRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
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
    private final OllamaLocalBatchProvider ollamaLocalBatchProvider;
    private final String activeProvider;
    private final int defaultMaxRequests;

    public BatchService(
            AnthropicBatchProvider anthropicBatchProvider,
            OpenAiBatchProvider openAiBatchProvider,
            String activeProvider) {
        this(anthropicBatchProvider, openAiBatchProvider, null, activeProvider, 1000);
    }

    @Autowired
    public BatchService(
            AnthropicBatchProvider anthropicBatchProvider,
            OpenAiBatchProvider openAiBatchProvider,
            OllamaLocalBatchProvider ollamaLocalBatchProvider,
            @Value("${ai.provider:openai}") String activeProvider,
            @Value("${ai.batch.max-requests-per-batch:1000}") int defaultMaxRequests) {
        this.anthropicBatchProvider = anthropicBatchProvider;
        this.openAiBatchProvider = openAiBatchProvider;
        this.ollamaLocalBatchProvider = ollamaLocalBatchProvider;
        this.activeProvider = activeProvider;
        this.defaultMaxRequests = defaultMaxRequests;

        log.info("BatchService initialisé avec provider: {}", activeProvider);

        try {
            if (!getActiveProvider().supportsBatching()) {
                log.warn("Provider {} ne supporte pas les opérations batch", activeProvider);
            }
        } catch (UnsupportedOperationException e) {
            log.warn("Opérations batch indisponibles pour le provider {}: {}", activeProvider, e.getMessage());
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

    public int getMaxRequestsPerBatch() {
        if ("ollama".equalsIgnoreCase(activeProvider) && ollamaLocalBatchProvider != null) {
            return ollamaLocalBatchProvider.getMaxRequests();
        }
        return defaultMaxRequests;
    }

    private BatchProvider getActiveProvider() {
        if (activeProvider == null) {
            throw new UnsupportedOperationException("Provider batch non configuré");
        }
        return switch (activeProvider.toLowerCase()) {
            case "anthropic" -> anthropicBatchProvider;
            case "openai" -> openAiBatchProvider;
            case "ollama" -> {
                if (ollamaLocalBatchProvider == null) {
                    throw new UnsupportedOperationException("OllamaLocalBatchProvider non initialisé");
                }
                yield ollamaLocalBatchProvider;
            }
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
