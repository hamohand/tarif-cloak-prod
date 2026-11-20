package com.tarif.search.service.ai.batch;

import com.tarif.search.controller.BatchSearchController;
import com.tarif.search.model.Position;
import com.tarif.search.service.Position10DzService;
import com.tarif.search.service.Position6DzService;
import com.tarif.search.service.TariffPositionService;
import com.tarif.search.service.ai.AiPrompts;
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

    @Test
    @DisplayName("Prompts batch adaptés selon HS-06, P10 (DZ) et NC8 (EU)")
    void batchPrompts_doiventRefleterLeModeEtLaZone() {
        String sysHs6 = AiPrompts.getBatchSystemMessage("POSITIONS6", "DZ");
        assertTrue(sysHs6.contains("HS-06"));

        String sysP10Dz = AiPrompts.getBatchSystemMessage("POSITIONS10", "DZ");
        assertTrue(sysP10Dz.contains("P10 à 10 chiffres"));

        String sysNc8Eu = AiPrompts.getBatchSystemMessage("POSITIONS10", "EU");
        assertTrue(sysNc8Eu.contains("NC8 à 8 chiffres"));

        String userPromptEu = AiPrompts.buildBatchUserPrompt("", "Pommes fraîches", "POSITIONS10", "EU");
        assertTrue(userPromptEu.contains("NC8 européen à 8 chiffres"));
        assertFalse(userPromptEu.contains("<codes_douaniers>"));
    }

    @Test
    @DisplayName("BatchSearchController normalise et enrichit P10 (DZ), NC8 (EU) et HS-06")
    void batchController_enrichitSelonModeEtZone() {
        BatchService batchService = org.mockito.Mockito.mock(BatchService.class);
        Position6DzService pos6Service = org.mockito.Mockito.mock(Position6DzService.class);
        Position10DzService pos10Service = org.mockito.Mockito.mock(Position10DzService.class);
        TariffPositionService tariffService = org.mockito.Mockito.mock(TariffPositionService.class);

        BatchStatus endedStatus = BatchStatus.builder()
                .id("batch_eu")
                .processingStatus("ended")
                .resultsUrl("file-1")
                .requestCounts(java.util.Map.of("succeeded", 1, "processing", 0, "errored", 0))
                .build();
        when(batchService.getBatchStatus("batch_eu")).thenReturn(endedStatus);

        // L'IA retourne un code SH6 080810 en mode NC8 (EU) -> résolu vers la feuille officielle 08081080
        when(batchService.getBatchResults("batch_eu")).thenReturn(List.of(
                BatchResult.builder()
                        .customId("item-1")
                        .resultType("succeeded")
                        .content("{\"items\":[{\"code\":\"0808 10\",\"justification\":\"Pommes de table.\"}]}")
                        .build()
        ));
        when(tariffService.getContextPositionsForHs6("EU", "080810")).thenReturn(List.of(
                new Position("08081010", "- - À cidre, en vrac"),
                new Position("08081080", "- - Autres")
        ));

        BatchSearchController controller = new BatchSearchController(
                batchService, pos6Service, pos10Service, tariffService);

        var response = controller.getBatchResults("batch_eu", "positions10", "EU");
        assertNotNull(response.getBody());
        String enrichedJson = response.getBody().getResults().get(0).getContent();
        assertTrue(enrichedJson.contains("\"08081080\""));
        assertTrue(enrichedJson.contains("- - Autres"));
    }

    @Test
    @DisplayName("Isolation stricte des batches par utilisateur (403 pour un autre utilisateur ou un ancien batch)")
    void batchController_isoleStrictementLesBatchesParUtilisateur() {
        BatchService batchService = org.mockito.Mockito.mock(BatchService.class);
        BatchOwnershipService ownershipService = new BatchOwnershipService(null);
        BatchSearchController controller = new BatchSearchController(
                batchService, null, null, null, ownershipService);

        when(batchService.createBatch(anyList())).thenReturn("batch_user_a");
        BatchStatus inProgress = BatchStatus.builder()
                .id("batch_user_a")
                .processingStatus("in_progress")
                .requestCounts(java.util.Map.of("processing", 1, "succeeded", 0, "errored", 0))
                .build();
        when(batchService.getBatchStatus("batch_user_a")).thenReturn(inProgress);

        try {
            // 1. User A soumet un batch
            setJwtUser("user-a-sub");
            BatchSearchController.SearchItem item = new BatchSearchController.SearchItem();
            item.setCustomId("s-1");
            item.setSearchTerm("Pommes fraîches");
            item.setRagContext("");
            BatchSearchController.BatchSearchRequest submitReq = new BatchSearchController.BatchSearchRequest();
            submitReq.setSearches(List.of(item));
            submitReq.setEndpoint("positions10");
            submitReq.setZone("DZ");

            var submitResp = controller.submitBatchSearch(submitReq);
            assertEquals(200, submitResp.getStatusCode().value());

            var myBatchesUserA = controller.getMyBatches();
            assertNotNull(myBatchesUserA.getBody());
            assertEquals(1, myBatchesUserA.getBody().size());
            assertEquals("batch_user_a", myBatchesUserA.getBody().get(0).getBatchId());
            assertEquals(200, controller.getBatchStatus("batch_user_a").getStatusCode().value());

            // 2. User B se connecte : ne voit aucun batch de User A et reçoit 403 sur statut/résultats/cancel
            setJwtUser("user-b-sub");
            var myBatchesUserB = controller.getMyBatches();
            assertNotNull(myBatchesUserB.getBody());
            assertTrue(myBatchesUserB.getBody().isEmpty());

            assertEquals(403, controller.getBatchStatus("batch_user_a").getStatusCode().value());
            assertEquals(403, controller.getBatchResults("batch_user_a", "positions10", "DZ").getStatusCode().value());
            assertEquals(403, controller.cancelBatch("batch_user_a").getStatusCode().value());

            // 3. Un ancien batch sans propriétaire enregistré est également bloqué (403)
            assertEquals(403, controller.getBatchStatus("batch_legacy_sans_proprietaire").getStatusCode().value());
        } finally {
            org.springframework.security.core.context.SecurityContextHolder.clearContext();
        }
    }

    private void setJwtUser(String subject) {
        org.springframework.security.oauth2.jwt.Jwt jwt = org.springframework.security.oauth2.jwt.Jwt
                .withTokenValue("mock-token-" + subject)
                .header("alg", "none")
                .claim("sub", subject)
                .build();
        var auth = new org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken(
                jwt, java.util.Collections.emptyList(), subject);
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
