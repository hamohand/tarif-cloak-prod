package com.tarif.search.service.ai.batch;

import com.tarif.search.service.ai.batch.models.BatchResult;
import com.tarif.search.service.ai.batch.models.BatchStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("OpenAiBatchProvider — statut et récupération des résultats batch")
class OpenAiBatchProviderTest {

    @Mock
    private RestTemplate restTemplate;

    @Test
    @DisplayName("Doit combiner output_file_id et error_file_id et parser les résultats")
    void getBatchResults_avecOutputEtErrorFile_doitCombinerLesResultats() {
        OpenAiBatchProvider provider = new OpenAiBatchProvider(
                restTemplate, "sk-test", "gpt-4.1-mini", "https://api.openai.com/v1");

        String batchJson = """
                {
                  "id": "batch_123",
                  "status": "completed",
                  "request_counts": {"total": 2, "completed": 1, "failed": 1},
                  "created_at": 1700000000,
                  "completed_at": 1700000100,
                  "output_file_id": "file-out-1",
                  "error_file_id": "file-err-1"
                }
                """;

        String outputJsonl = """
                {"id":"req_1","custom_id":"search-0","response":{"status_code":200,"body":{"choices":[{"message":{"content":"{\\"codes\\":[{\\"code\\":\\"0808 10\\",\\"justification\\":\\"Pommes fraîches.\\"}]}"}}],"usage":{"prompt_tokens":120,"completion_tokens":30}}}}
                """;

        String errorJsonl = """
                {"id":"req_2","custom_id":"search-1","response":null,"error":{"code":"rate_limit","message":"Limite atteinte"}}
                """;

        when(restTemplate.exchange(
                eq("https://api.openai.com/v1/batches/batch_123"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(String.class)
        )).thenReturn(ResponseEntity.ok(batchJson));

        when(restTemplate.exchange(
                eq("https://api.openai.com/v1/files/file-out-1/content"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(String.class)
        )).thenReturn(ResponseEntity.ok(outputJsonl));

        when(restTemplate.exchange(
                eq("https://api.openai.com/v1/files/file-err-1/content"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(String.class)
        )).thenReturn(ResponseEntity.ok(errorJsonl));

        BatchStatus status = provider.getBatchStatus("batch_123");
        assertNotNull(status);
        assertTrue(status.isEnded());
        assertEquals("file-out-1,file-err-1", status.getResultsUrl());

        List<BatchResult> results = provider.getBatchResults("batch_123");
        assertEquals(2, results.size());
        assertEquals("succeeded", results.get(0).getResultType());
        assertTrue(results.get(0).getContent().contains("0808 10"));
        assertEquals("errored", results.get(1).getResultType());
        assertEquals("Limite atteinte", results.get(1).getErrorMessage());
    }
}
