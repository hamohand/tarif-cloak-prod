package com.muhend.backend.organization.service;

import com.muhend.backend.organization.dto.OrganizationDto;
import com.muhend.backend.organization.dto.OrganizationMapper;
import com.muhend.backend.organization.exception.QuotaExceededException;
import com.muhend.backend.organization.model.Organization;
import com.muhend.backend.organization.repository.OrganizationRepository;
import com.muhend.backend.pricing.service.PricingPlanService;
import com.muhend.backend.usage.repository.UsageLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class QuotaServiceTest {

    @Mock
    private OrganizationRepository organizationRepository;

    @Mock
    private UsageLogRepository usageLogRepository;

    @Mock
    private PricingPlanService pricingPlanService;

    @Mock
    private OrganizationMapper organizationMapper;

    @InjectMocks
    private QuotaService quotaService;

    private Organization organization;

    @BeforeEach
    void setUp() {
        organization = new Organization();
        organization.setId(1L);
        organization.setName("Test Organization");

        ReflectionTestUtils.setField(quotaService, "creditsPositions10", 15);
        ReflectionTestUtils.setField(quotaService, "creditsPositions6", 10);
        ReflectionTestUtils.setField(quotaService, "creditsDecodep10", 5);
        ReflectionTestUtils.setField(quotaService, "creditsDecode", 2);
        ReflectionTestUtils.setField(quotaService, "creditsDefault", 1);
    }

    // =========================================================
    // checkQuota
    // =========================================================

    @Test
    void testCheckQuota_WhenOrganizationIsNull_ShouldThrowException() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () ->
                quotaService.checkQuota(null));
        assertTrue(exception.getMessage().contains("organisation"));
        verify(organizationRepository, never()).findById(any());
    }

    @Test
    void testCheckQuota_WhenOrganizationNotFound_ShouldThrowException() {
        when(organizationRepository.findById(1L)).thenReturn(Optional.empty());

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () ->
                quotaService.checkQuota(1L));

        assertTrue(exception.getMessage().contains("Organisation non trouvée"));
        verify(organizationRepository).findById(1L);
        verify(usageLogRepository, never()).findByOrganizationIdAndTimestampBetween(any(), any(), any());
    }

    @Test
    void testCheckQuota_WhenQuotaIsNull_ShouldReturnTrue() {
        organization.setMonthlyQuota(null);
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(organization));

        assertTrue(quotaService.checkQuota(1L));
        verify(usageLogRepository, never()).findByOrganizationIdAndTimestampBetween(any(), any(), any());
    }

    @Test
    void testCheckQuota_WhenQuotaNotExceeded_ShouldReturnTrue() {
        organization.setMonthlyQuota(100);
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(organization));
        when(usageLogRepository.findByOrganizationIdAndTimestampBetween(eq(1L), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of());
        when(organizationMapper.computeCredits(anyList())).thenReturn(50L);

        assertTrue(quotaService.checkQuota(1L));
    }

    @Test
    void testCheckQuota_WhenQuotaExceeded_ShouldThrowQuotaExceededException() {
        organization.setMonthlyQuota(100);
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(organization));
        when(usageLogRepository.findByOrganizationIdAndTimestampBetween(eq(1L), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of());
        when(organizationMapper.computeCredits(anyList())).thenReturn(100L);

        QuotaExceededException exception = assertThrows(QuotaExceededException.class, () ->
                quotaService.checkQuota(1L));

        assertTrue(exception.getMessage().contains("Test Organization"));
        assertTrue(exception.getMessage().contains("100/100"));
    }

    @Test
    void testCheckQuota_WhenQuotaExceededMoreThanQuota_ShouldThrowQuotaExceededException() {
        organization.setMonthlyQuota(100);
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(organization));
        when(usageLogRepository.findByOrganizationIdAndTimestampBetween(eq(1L), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of());
        when(organizationMapper.computeCredits(anyList())).thenReturn(150L);

        QuotaExceededException exception = assertThrows(QuotaExceededException.class, () ->
                quotaService.checkQuota(1L));

        assertTrue(exception.getMessage().contains("Quota mensuel dépassé"));
        assertTrue(exception.getMessage().contains("150/100"));
    }

    // =========================================================
    // updateMonthlyQuota
    // =========================================================

    @Test
    void testUpdateMonthlyQuota_WhenOrganizationExists_ShouldUpdateQuota() {
        organization.setMonthlyQuota(50);
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(organization));
        when(organizationRepository.save(any(Organization.class))).thenReturn(organization);
        OrganizationDto dto = new OrganizationDto();
        dto.setMonthlyQuota(200);
        when(organizationMapper.toDto(organization)).thenReturn(dto);

        OrganizationDto result = quotaService.updateMonthlyQuota(1L, 200);

        assertNotNull(result);
        assertEquals(200, result.getMonthlyQuota());
        assertEquals(200, organization.getMonthlyQuota());
        verify(organizationRepository).save(organization);
    }

    @Test
    void testUpdateMonthlyQuota_WhenSettingQuotaToNull_ShouldSetUnlimitedQuota() {
        organization.setMonthlyQuota(100);
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(organization));
        when(organizationRepository.save(any(Organization.class))).thenReturn(organization);
        OrganizationDto dto = new OrganizationDto();
        dto.setMonthlyQuota(null);
        when(organizationMapper.toDto(organization)).thenReturn(dto);

        OrganizationDto result = quotaService.updateMonthlyQuota(1L, null);

        assertNotNull(result);
        assertNull(result.getMonthlyQuota());
        assertNull(organization.getMonthlyQuota());
        verify(organizationRepository).save(organization);
    }

    @Test
    void testUpdateMonthlyQuota_WhenOrganizationNotFound_ShouldThrowException() {
        when(organizationRepository.findById(1L)).thenReturn(Optional.empty());

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () ->
                quotaService.updateMonthlyQuota(1L, 100));

        assertTrue(exception.getMessage().contains("Organisation non trouvée"));
        verify(organizationRepository, never()).save(any());
    }
}
