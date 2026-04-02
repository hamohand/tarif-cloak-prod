package com.muhend.backend.organization.service;

import com.muhend.backend.organization.exception.QuotaExceededException;
import com.muhend.backend.organization.model.Organization;
import com.muhend.backend.organization.repository.OrganizationRepository;
import com.muhend.backend.organization.repository.OrganizationUserRepository;
import com.muhend.backend.usage.repository.UsageLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Tests unitaires pour OrganizationService - Phase 4 MVP : Quotas Basiques
 */
@ExtendWith(MockitoExtension.class)
class OrganizationServiceTest {

    @Mock
    private OrganizationRepository organizationRepository;

    @Mock
    private OrganizationUserRepository organizationUserRepository;

    @Mock
    private UsageLogRepository usageLogRepository;

    @InjectMocks
    private OrganizationService organizationService;

    private Organization organization;

    @BeforeEach
    void setUp() {
        organization = new Organization();
        organization.setId(1L);
        organization.setName("Test Organization");
        organization.setCreatedAt(LocalDateTime.now());
        
        ReflectionTestUtils.setField(organizationService, "creditsPositions10", 15);
        ReflectionTestUtils.setField(organizationService, "creditsPositions6", 10);
        ReflectionTestUtils.setField(organizationService, "creditsDecodep10", 5);
        ReflectionTestUtils.setField(organizationService, "creditsDecode", 2);
        ReflectionTestUtils.setField(organizationService, "creditsDefault", 1);
    }

    @Test
    void testCheckQuota_WhenOrganizationIsNull_ShouldThrowException() {
        // Test: Si organizationId est null, une exception est levée
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> {
            organizationService.checkQuota(null);
        });
        assertTrue(exception.getMessage().contains("organisation"));
        verify(organizationRepository, never()).findById(any());
    }

    @Test
    void testCheckQuota_WhenOrganizationNotFound_ShouldThrowException() {
        // Test: Si l'organisation n'existe pas, on lève une exception
        when(organizationRepository.findById(1L)).thenReturn(Optional.empty());

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> {
            organizationService.checkQuota(1L);
        });

        assertTrue(exception.getMessage().contains("Organisation non trouvée"));
        verify(organizationRepository).findById(1L);
        verify(usageLogRepository, never()).findByOrganizationIdAndTimestampBetween(any(), any(), any());
    }

    @Test
    void testCheckQuota_WhenQuotaIsNull_ShouldReturnTrue() {
        // Test: Si monthlyQuota est null, le quota est illimité
        organization.setMonthlyQuota(null);
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(organization));

        assertTrue(organizationService.checkQuota(1L));
        verify(organizationRepository).findById(1L);
        verify(usageLogRepository, never()).findByOrganizationIdAndTimestampBetween(any(), any(), any());
    }

    @Test
    void testCheckQuota_WhenQuotaNotExceeded_ShouldReturnTrue() {
        // Test: Si le quota n'est pas dépassé, on autorise
        organization.setMonthlyQuota(100);
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(organization));
        when(usageLogRepository.findByOrganizationIdAndTimestampBetween(eq(1L), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(createMockUsageLogs(50)); // 50 requêtes (par défaut 1 crédit chacune = 50 crédits)

        assertTrue(organizationService.checkQuota(1L));
        verify(organizationRepository).findById(1L);
        verify(usageLogRepository).findByOrganizationIdAndTimestampBetween(eq(1L), any(LocalDateTime.class), any(LocalDateTime.class));
    }

    @Test
    void testCheckQuota_WhenQuotaExceeded_ShouldThrowQuotaExceededException() {
        // Test: Si le quota est dépassé, on lève une exception
        organization.setMonthlyQuota(100);
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(organization));
        when(usageLogRepository.findByOrganizationIdAndTimestampBetween(eq(1L), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(createMockUsageLogs(100)); // 100 requêtes (100 crédits) (quota atteint)

        QuotaExceededException exception = assertThrows(QuotaExceededException.class, () -> {
            organizationService.checkQuota(1L);
        });

        assertTrue(exception.getMessage().contains("Test Organization"));
        assertTrue(exception.getMessage().contains("100/100"));
        verify(organizationRepository).findById(1L);
        verify(usageLogRepository).findByOrganizationIdAndTimestampBetween(eq(1L), any(LocalDateTime.class), any(LocalDateTime.class));
    }

    @Test
    void testCheckQuota_WhenQuotaExceeded_MoreThanQuota_ShouldThrowQuotaExceededException() {
        // Test: Si le quota est dépassé (plus que le quota), on lève une exception
        organization.setMonthlyQuota(100);
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(organization));
        when(usageLogRepository.findByOrganizationIdAndTimestampBetween(eq(1L), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(createMockUsageLogs(150)); // 150 requêtes (150 crédits) (quota dépassé)

        QuotaExceededException exception = assertThrows(QuotaExceededException.class, () -> {
            organizationService.checkQuota(1L);
        });

        assertTrue(exception.getMessage().contains("Quota mensuel dépassé"));
        assertTrue(exception.getMessage().contains("150/100"));
        verify(organizationRepository).findById(1L);
        verify(usageLogRepository).findByOrganizationIdAndTimestampBetween(eq(1L), any(LocalDateTime.class), any(LocalDateTime.class));
    }

    private java.util.List<com.muhend.backend.usage.model.UsageLog> createMockUsageLogs(int count) {
        java.util.List<com.muhend.backend.usage.model.UsageLog> logs = new java.util.ArrayList<>();
        for (int i = 0; i < count; i++) {
            com.muhend.backend.usage.model.UsageLog log = new com.muhend.backend.usage.model.UsageLog();
            log.setEndpoint("default"); // Cela donnera 1 crédit (creditsDefault) par log car creditsDefault=1 par défaut si l'endpoint ne match pas les clés
            logs.add(log);
        }
        return logs;
    }

    @Test
    void testResetPlan_ShouldResetConsumptionCycleAndZeroCredits() {
        // Configuration de l'organisation avant la réinitialisation
        organization.setMonthlyPlanStartDate(java.time.LocalDate.now().minusDays(15));
        organization.setMonthlyPlanEndDate(java.time.LocalDate.now().minusDays(15).plusDays(30));
        organization.setMonthlyQuota(100);

        when(organizationRepository.findById(1L)).thenReturn(Optional.of(organization));
        when(organizationRepository.save(any(Organization.class))).thenAnswer(i -> i.getArgument(0));

        // On ignore les collaborateurs pour ce test
        when(organizationUserRepository.findByOrganizationId(1L)).thenReturn(java.util.List.of());

        // Exécution du resetPlan
        com.muhend.backend.organization.dto.OrganizationDto result = organizationService.resetPlan(1L);

        // Validation 1: Les dates de cycle du plan sont mises à jour à "aujourd'hui"
        java.time.LocalDate today = java.time.LocalDate.now();
        assertEquals(today, organization.getMonthlyPlanStartDate());
        assertEquals(today.plusDays(30), organization.getMonthlyPlanEndDate());
        
        // Validation 2: Lorsqu'on verifie le quota pour l'organisation réinitialisée,
        // les bornes demandées à la base de données correspondent au nouveau cycle !
        when(usageLogRepository.findByOrganizationIdAndTimestampBetween(eq(1L), any(), any()))
                .thenReturn(java.util.List.of());

        assertTrue(organizationService.checkQuota(1L));

        // Le repository doit être interrogé avec le début du cycle "aujourd'hui" (0 crédits consommés depuis aujourd'hui)
        verify(usageLogRepository).findByOrganizationIdAndTimestampBetween(
                eq(1L), 
                eq(today.atStartOfDay()), 
                eq(today.plusDays(30).atTime(23, 59, 59, 999999999))
        );
    }


    @Test
    void testUpdateMonthlyQuota_WhenOrganizationExists_ShouldUpdateQuota() {
        // Test: Mise à jour du quota d'une organisation existante
        organization.setMonthlyQuota(50);
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(organization));
        when(organizationRepository.save(any(Organization.class))).thenReturn(organization);

        var result = organizationService.updateMonthlyQuota(1L, 200);

        assertNotNull(result);
        assertEquals(200, result.getMonthlyQuota());
        verify(organizationRepository).findById(1L);
        verify(organizationRepository).save(organization);
        assertEquals(200, organization.getMonthlyQuota());
    }

    @Test
    void testUpdateMonthlyQuota_WhenSettingQuotaToNull_ShouldSetUnlimitedQuota() {
        // Test: Mettre le quota à null pour quota illimité
        organization.setMonthlyQuota(100);
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(organization));
        when(organizationRepository.save(any(Organization.class))).thenReturn(organization);

        var result = organizationService.updateMonthlyQuota(1L, null);

        assertNotNull(result);
        assertNull(result.getMonthlyQuota());
        verify(organizationRepository).findById(1L);
        verify(organizationRepository).save(organization);
        assertNull(organization.getMonthlyQuota());
    }

    @Test
    void testUpdateMonthlyQuota_WhenOrganizationNotFound_ShouldThrowException() {
        // Test: Si l'organisation n'existe pas, on lève une exception
        when(organizationRepository.findById(1L)).thenReturn(Optional.empty());

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> {
            organizationService.updateMonthlyQuota(1L, 100);
        });

        assertTrue(exception.getMessage().contains("Organisation non trouvée"));
        verify(organizationRepository).findById(1L);
        verify(organizationRepository, never()).save(any());
    }
}

