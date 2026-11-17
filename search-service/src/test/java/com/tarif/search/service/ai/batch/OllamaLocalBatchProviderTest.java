package com.tarif.search.service.ai.batch;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tarif.search.model.Position;
import com.tarif.search.model.UsageInfo;
import com.tarif.search.service.SearchService;
import com.tarif.search.service.SearchService.SearchLevel;
import com.tarif.search.service.ai.OllamaService;
import com.tarif.search.service.ai.batch.models.BatchResult;
import com.tarif.search.service.ai.batch.models.BatchStatus;
import com.tarif.search.service.ai.batch.models.SearchRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("OllamaLocalBatchProvider & BatchService (mode ollama)")
class OllamaLocalBatchProviderTest {

    @Mock
    private SearchService searchService;

    @Mock
    private OllamaService ollamaService;

    @Mock
    private AnthropicBatchProvider anthropicBatchProvider;

    @Mock
    private OpenAiBatchProvider openAiBatchProvider;

    private OllamaLocalBatchProvider provider;
    private BatchService batchService;

    @BeforeEach
    void setUp() {
        provider = new OllamaLocalBatchProvider(
                searchService,
                ollamaService,
                new ObjectMapper(),
                null,
                300,
                1,
                "POSITIONS10",
                168L
        );
        batchService = new BatchService(
                anthropicBatchProvider,
                openAiBatchProvider,
                provider,
                "ollama",
                1000
        );
    }

    @AfterEach
    void tearDown() {
        provider.shutdown();
    }

    @Test
    @DisplayName("BatchService démarre sans crash quand ai.provider=ollama")
    void batchService_avecProviderOllama_doitDemarrerSansException() {
        assertThatCode(() -> new BatchService(
                anthropicBatchProvider,
                openAiBatchProvider,
                provider,
                "ollama",
                1000
        )).doesNotThrowAnyException();

        assertThat(batchService.getMaxRequestsPerBatch()).isEqualTo(300);
    }

    @Test
    @DisplayName("createBatch exécute SearchService localement, définit resultsUrl et retourne le JSON")
    void createBatch_doitTraiterItemsViaSearchServiceEtRetournerResultats() throws Exception {
        when(searchService.search("pommes", SearchLevel.POSITIONS10))
                .thenReturn(List.of(new Position("0808 10 10 00", "Pommes de table", "Correspond aux pommes fraîches")));
        when(ollamaService.getLastUsageInfo()).thenReturn(new UsageInfo(150, 0.0, 100, 50, 0.0));

        String batchId = batchService.createBatch(List.of(
                SearchRequest.builder()
                        .customId("item-1")
                        .searchTerm("pommes")
                        .ragContext("RAG pour la recherche des : POSITIONS6\n\n")
                        .build()
        ));

        assertThat(batchId).startsWith("local-batch-");

        BatchStatus status = waitForBatchCompletion(batchId);
        assertThat(status.isEnded()).isTrue();
        assertThat(status.getResultsUrl()).isNotNull();
        assertThat(status.getRequestCounts().get("succeeded")).isEqualTo(1);
        assertThat(status.getRequestCounts().get("errored")).isEqualTo(0);

        List<BatchResult> results = batchService.getBatchResults(batchId);
        assertThat(results).hasSize(1);
        assertThat(results.get(0).isSuccess()).isTrue();
        assertThat(results.get(0).getCustomId()).isEqualTo("item-1");
        assertThat(results.get(0).getContent()).contains("0808 10 10 00");
        assertThat(results.get(0).getInputTokens()).isEqualTo(100);
        assertThat(results.get(0).getOutputTokens()).isEqualTo(50);
    }

    @Test
    @DisplayName("cancelBatch interrompt les éléments restants")
    void cancelBatch_doitMarquerItemsRestantsCommeAnnules() throws Exception {
        CountDownLatch item1Started = new CountDownLatch(1);
        CountDownLatch releaseItem1 = new CountDownLatch(1);

        when(searchService.search("item1", SearchLevel.POSITIONS10)).thenAnswer(inv -> {
            item1Started.countDown();
            releaseItem1.await(5, TimeUnit.SECONDS);
            return List.of(new Position("0101", "Chevaux", "ok"));
        });

        String batchId = batchService.createBatch(List.of(
                SearchRequest.builder().customId("c1").searchTerm("item1").build(),
                SearchRequest.builder().customId("c2").searchTerm("item2").build()
        ));

        assertThat(item1Started.await(5, TimeUnit.SECONDS)).isTrue();
        boolean canceled = batchService.cancelBatch(batchId);
        assertThat(canceled).isTrue();
        releaseItem1.countDown();

        BatchStatus status = waitForBatchCompletion(batchId);
        assertThat(status.isEnded()).isTrue();
        assertThat(status.getRequestCounts().get("succeeded")).isEqualTo(1);
        assertThat(status.getRequestCounts().get("canceled")).isEqualTo(1);

        List<BatchResult> results = batchService.getBatchResults(batchId);
        assertThat(results).hasSize(2);
        assertThat(results).anyMatch(r -> "c2".equals(r.getCustomId()) && "canceled".equals(r.getResultType()));
    }

    @Test
    @DisplayName("Dépassement de la limite locale lève IllegalArgumentException")
    void createBatch_auDelaDuMaxLocal_doitLeverException() {
        OllamaLocalBatchProvider smallProvider = new OllamaLocalBatchProvider(
                searchService, ollamaService, new ObjectMapper(), null, 1, 1, "POSITIONS10", 168L);
        try {
            List<SearchRequest> two = List.of(
                    SearchRequest.builder().customId("1").searchTerm("a").build(),
                    SearchRequest.builder().customId("2").searchTerm("b").build()
            );
            assertThatThrownBy(() -> smallProvider.createBatch(two))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Maximum 1");
        } finally {
            smallProvider.shutdown();
        }
    }

    private BatchStatus waitForBatchCompletion(String batchId) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 5000;
        BatchStatus status = batchService.getBatchStatus(batchId);
        while (status != null && !status.isEnded() && System.currentTimeMillis() < deadline) {
            Thread.sleep(20);
            status = batchService.getBatchStatus(batchId);
        }
        return status;
    }
}
