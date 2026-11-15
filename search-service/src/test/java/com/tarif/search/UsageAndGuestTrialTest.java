package com.tarif.search;

import com.tarif.search.client.BackendFallback;
import com.tarif.search.dto.QuotaCheckResponse;
import com.tarif.search.model.Position;
import com.tarif.search.model.TariffPosition;
import com.tarif.search.model.UsageInfo;
import com.tarif.search.repository.TariffPositionRepository;
import com.tarif.search.service.GuestTrialService;
import com.tarif.search.service.TariffPositionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

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
}
