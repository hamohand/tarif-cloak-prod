package com.tarif.search;

import com.tarif.search.client.BackendClient;
import com.tarif.search.client.BackendFallback;
import com.tarif.search.controller.RechercheController;
import com.tarif.search.dto.QuotaCheckResponse;
import com.tarif.search.event.SearchEventPublisher;
import com.tarif.search.model.Position;
import com.tarif.search.model.TariffPosition;
import com.tarif.search.model.UsageInfo;
import com.tarif.search.repository.TariffPositionRepository;
import com.tarif.search.service.GuestTrialService;
import com.tarif.search.service.SearchService;
import com.tarif.search.service.TariffPositionService;
import com.tarif.search.service.ai.AiPrompts;
import com.tarif.search.service.ai.AiService;
import com.tarif.search.service.ai.OpenAiService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

class UsageAndGuestTrialTest {

    @Test
    void accumulateSumsTokensAndTokenCostWithoutMultiplyingBaseCost() {
        UsageInfo level1 = new UsageInfo(120, 0.015, 100, 20, 0.0004);
        UsageInfo level2 = new UsageInfo(250, 0.015, 200, 50, 0.0009);

        UsageInfo total = UsageInfo.accumulate(level1, level2);

        assertEquals(370, total.getTokens());
        assertEquals(300, total.getPromptTokens());
        assertEquals(70, total.getCompletionTokens());
        assertEquals(0.015, total.getCostUsd(), 1e-6);
        assertEquals(0.0013, total.getTokenCostUsd(), 1e-6);
    }

    @Test
    void backendFallbackIsFailClosed() {
        BackendFallback fallback = new BackendFallback();
        QuotaCheckResponse response = fallback.checkQuota("Bearer token");

        assertFalse(response.isCanSearch());
        assertFalse(response.isQuotaOk());
        assertNotNull(response.getMessage());
        assertTrue(response.getMessage().startsWith("BACKEND_UNAVAILABLE:"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void guestTrialEnforcesPerIpAndGlobalDailyLimits() {
        ObjectProvider<StringRedisTemplate> redisProvider = mock(ObjectProvider.class);
        when(redisProvider.getIfAvailable()).thenReturn(null);

        GuestTrialService service = new GuestTrialService(redisProvider, 2, 3);

        GuestTrialService.TrialStatus t1 = service.tryConsumeTrial("198.51.100.1");
        assertTrue(t1.allowed());
        assertEquals(1, t1.remaining());

        GuestTrialService.TrialStatus t2 = service.tryConsumeTrial("198.51.100.1");
        assertTrue(t2.allowed());
        assertEquals(0, t2.remaining());

        GuestTrialService.TrialStatus t3SameIp = service.tryConsumeTrial("198.51.100.1");
        assertFalse(t3SameIp.allowed());
        assertEquals(0, t3SameIp.remaining());

        GuestTrialService.TrialStatus t4OtherIp = service.tryConsumeTrial("198.51.100.2");
        assertTrue(t4OtherIp.allowed());
        assertEquals(1, t4OtherIp.remaining());

        // Global limit (3) is now exhausted
        GuestTrialService.TrialStatus t5GlobalExhausted = service.tryConsumeTrial("198.51.100.3");
        assertFalse(t5GlobalExhausted.allowed());
        assertEquals(0, t5GlobalExhausted.remaining());
    }

    @Test
    @SuppressWarnings("unchecked")
    void guestTrialSingleLimitUsesSingularMessageAndIssuesEnrichmentPass() {
        ObjectProvider<StringRedisTemplate> redisProvider = mock(ObjectProvider.class);
        when(redisProvider.getIfAvailable()).thenReturn(null);

        GuestTrialService service = new GuestTrialService(redisProvider, 1, 10, "unit-test-secret");
        GuestTrialService.TrialStatus first = service.tryConsumeTrial("198.51.100.9");
        assertTrue(first.allowed());
        assertEquals(0, first.remaining());

        GuestTrialService.TrialStatus second = service.tryConsumeTrial("198.51.100.9");
        assertFalse(second.allowed());
        assertTrue(second.reason().startsWith("Essai gratuit épuisé (1 recherche découverte"));

        String pass = service.issueEnrichmentPass("198.51.100.9");
        assertNotNull(pass);
        String[] parts = pass.split("\\.");
        assertEquals(2, parts.length);
        assertTrue(Long.parseLong(parts[0]) > 0);
        assertEquals(64, parts[1].length());
    }

    @Test
    void tariffPositionServiceReconstructsAncestorTitlesAndSkipsDashlessHeaders() {
        TariffPositionRepository repo = mock(TariffPositionRepository.class);
        when(repo.findByZoneCodeAndPos4CodeOrderByRowOrderAsc("DZ", "0101")).thenReturn(List.of(
                new TariffPosition(1L, "DZ", "0101", "0101", "", "Chevaux, ânes, mulets et bardots, vivants.", 0, true, 1),
                new TariffPosition(2L, "DZ", "", "0101", "", "Désignation des Produits", 0, true, 2),
                new TariffPosition(3L, "DZ", "", "0101", "", "- Chevaux :", 1, true, 3),
                new TariffPosition(4L, "DZ", "", "0101", "", "- - Reproducteurs de race pure :", 2, true, 4),
                new TariffPosition(5L, "DZ", "", "0101", "", "- - - Autres que de course :", 3, true, 5),
                new TariffPosition(6L, "DZ", "0101219100", "0101", "010121", "- - - - De pur sang arabe", 4, false, 6),
                new TariffPosition(7L, "DZ", "", "0101", "", "- - Autres :", 2, true, 7),
                new TariffPosition(8L, "DZ", "0101291000", "0101", "010129", "- - - De course", 3, false, 8)
        ));

        TariffPositionService service = new TariffPositionService(repo);
        List<Position> context = service.getContextPositionsForHs6("DZ", "010121");

        assertEquals(4, context.size());
        assertEquals("", context.get(0).getCode());
        assertEquals("- Chevaux :", context.get(0).getDescription());
        assertEquals("- - Reproducteurs de race pure :", context.get(1).getDescription());
        assertEquals("- - - Autres que de course :", context.get(2).getDescription());
        assertEquals("0101219100", context.get(3).getCode());
        assertEquals("- - - - De pur sang arabe", context.get(3).getDescription());
    }

    @Test
    void authenticatedMonthlyPlanPublishesSearchEventWithNullCost() {
        SearchService searchService = mock(SearchService.class);
        AiService aiService = mock(AiService.class);
        BackendClient backendClient = mock(BackendClient.class);
        SearchEventPublisher eventPublisher = mock(SearchEventPublisher.class);
        GuestTrialService guestTrialService = mock(GuestTrialService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);

        Jwt jwt = Jwt.withTokenValue("test-jwt-token")
                .header("alg", "none")
                .subject("user-123")
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));

        try {
            QuotaCheckResponse quota = QuotaCheckResponse.builder()
                    .canSearch(true)
                    .quotaOk(true)
                    .canUsePayPerRequest(false)
                    .organizationId(42L)
                    .currentUsage(1)
                    .monthlyQuota(100)
                    .build();
            when(backendClient.checkQuota("Bearer test-jwt-token")).thenReturn(quota);
            when(searchService.search("pommes", SearchService.SearchLevel.POSITIONS6, "DZ"))
                    .thenReturn(List.of(new Position("080810", "Pommes")));
            when(aiService.getCurrentUsage()).thenReturn(new UsageInfo(150, 0.01, 100, 50, 0.0005));

            RechercheController controller = new RechercheController(
                    searchService, aiService, backendClient, eventPublisher, guestTrialService);

            List<Position> result = controller.reponsePositions6("pommes", "DZ", request, response);

            assertEquals(1, result.size());
            verify(eventPublisher, times(1)).publishSearchCompleted(
                    eq("user-123"), eq(42L), eq("/recherche/positions6"), eq("pommes"), eq(150), isNull());
            verify(aiService, times(1)).clearCurrentUsage();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    @SuppressWarnings("unchecked")
    void openAiServiceDisablesDeprecatedFastModelOn404AndFallsBackImmediately() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        AiPrompts aiPrompts = new AiPrompts();
        OpenAiService openAiService = new OpenAiService(
                aiPrompts, restTemplate, "sk-test", "https://api.openai.com/v1",
                "gpt-4.1-mini", "gpt-4.1-nano",
                0.01, 0.40, 1.60, 0.10, 0.40);

        String successPayload = """
                {
                  "choices": [{"message": {"content": "{\\"items\\": [{\\"code\\": \\"08\\"}]}"}}],
                  "usage": {"prompt_tokens": 50, "completion_tokens": 10, "total_tokens": 60}
                }
                """;

        when(restTemplate.exchange(
                eq("https://api.openai.com/v1/chat/completions"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(String.class)))
                .thenAnswer(invocation -> {
                    HttpEntity<String> req = invocation.getArgument(2);
                    String body = req.getBody();
                    if (body != null && body.contains("\"gpt-4.1-nano\"")) {
                        throw HttpClientErrorException.create(
                                HttpStatus.NOT_FOUND,
                                "Not Found",
                                HttpHeaders.EMPTY,
                                "{\"error\":{\"code\":\"model_not_found\"}}".getBytes(StandardCharsets.UTF_8),
                                StandardCharsets.UTF_8);
                    }
                    return ResponseEntity.ok(successPayload);
                });

        try {
            String first = openAiService.demanderAiAide("CHAPITRES", "Pommes", false, "CHAPITRES", true);
            assertTrue(first.contains("08"));

            String second = openAiService.demanderAiAide("CHAPITRES", "Pommes", false, "CHAPITRES", true);
            assertTrue(second.contains("08"));

            // Appel 1: fastModel 404 + repli mini ; Appel 2: mini direct (fastModel désactivé) -> 3 échanges HTTP
            verify(restTemplate, times(3)).exchange(
                    eq("https://api.openai.com/v1/chat/completions"),
                    eq(HttpMethod.POST),
                    any(HttpEntity.class),
                    eq(String.class));
        } finally {
            openAiService.clearUsageInfo();
        }
    }

    @Test
    @SuppressWarnings("unchecked")
    void openAiServiceSupportsGpt6LunaWithLowReasoningEffort() {
        assertTrue(OpenAiService.isReasoningModel("gpt-6-luna"));
        assertTrue(OpenAiService.isReasoningModel("gpt-5-nano"));
        assertFalse(OpenAiService.isReasoningModel("gpt-4.1-mini"));

        RestTemplate restTemplate = mock(RestTemplate.class);
        AiPrompts aiPrompts = new AiPrompts();
        OpenAiService openAiService = new OpenAiService(
                aiPrompts, restTemplate, "sk-test", "https://api.openai.com/v1",
                "gpt-4.1-mini", "", "gpt-6-luna", "low",
                0.01, 0.40, 1.60, 0.10, 0.50);

        String successPayload = """
                {
                  "choices": [{"message": {"content": "{\\"items\\": [{\\"code\\": \\"08\\"}]}"}}],
                  "usage": {"prompt_tokens": 50, "completion_tokens": 10, "total_tokens": 60}
                }
                """;

        StringBuilder capturedBody = new StringBuilder();
        when(restTemplate.exchange(
                eq("https://api.openai.com/v1/chat/completions"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(String.class)))
                .thenAnswer(invocation -> {
                    HttpEntity<String> req = invocation.getArgument(2);
                    capturedBody.append(req.getBody());
                    return ResponseEntity.ok(successPayload);
                });

        try {
            String result = openAiService.demanderAiAide("CHAPITRES", "Pommes", false, "CHAPITRES", true);
            assertTrue(result.contains("08"));
            String payload = capturedBody.toString();
            assertTrue(payload.contains("\"model\":\"gpt-6-luna\""));
            assertTrue(payload.contains("\"reasoning_effort\":\"low\""));
            assertTrue(payload.contains("\"max_completion_tokens\":2048"));
            assertFalse(payload.contains("\"max_tokens\""));
            assertFalse(payload.contains("\"temperature\""));
        } finally {
            openAiService.clearUsageInfo();
        }
    }
}
