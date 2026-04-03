package com.muhend.backend.organization.service;

import com.muhend.backend.alert.repository.QuotaAlertRepository;
import com.muhend.backend.email.service.EmailService;
import com.muhend.backend.invoice.service.InvoiceService;
import com.muhend.backend.organization.dto.OrganizationDto;
import com.muhend.backend.organization.dto.OrganizationMapper;
import com.muhend.backend.organization.model.Organization;
import com.muhend.backend.organization.repository.OrganizationRepository;
import com.muhend.backend.organization.repository.OrganizationUserRepository;
import com.muhend.backend.pricing.service.PricingPlanService;
import com.muhend.backend.usage.repository.UsageLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PlanChangeServiceTest {

    @Mock private OrganizationRepository organizationRepository;
    @Mock private OrganizationUserRepository organizationUserRepository;
    @Mock private UsageLogRepository usageLogRepository;
    @Mock private PricingPlanService pricingPlanService;
    @Mock private EmailService emailService;
    @Mock private InvoiceService invoiceService;
    @Mock private QuotaService quotaService;
    @Mock private CollaboratorService collaboratorService;
    @Mock private QuotaAlertRepository quotaAlertRepository;
    @Mock private OrganizationMapper organizationMapper;

    @InjectMocks
    private PlanChangeService planChangeService;

    private Organization organization;

    @BeforeEach
    void setUp() {
        organization = new Organization();
        organization.setId(1L);
        organization.setName("Test Organization");
        organization.setMonthlyQuota(100);
    }

    @Test
    void testResetPlan_WhenOrganizationExists_ShouldResetCycleAndClearLogs() {
        when(organizationRepository.findById(1L)).thenReturn(Optional.of(organization));
        when(organizationRepository.save(any(Organization.class))).thenAnswer(i -> i.getArgument(0));
        when(usageLogRepository.deleteByOrganizationId(1L)).thenReturn(5);
        OrganizationDto dto = new OrganizationDto();
        dto.setMonthlyQuota(100);
        when(organizationMapper.toDto(any(Organization.class))).thenReturn(dto);

        LocalDate today = LocalDate.now();
        OrganizationDto result = planChangeService.resetPlan(1L);

        // Cycle remis à aujourd'hui
        assertEquals(today, organization.getMonthlyPlanStartDate());
        assertEquals(today.plusDays(30), organization.getMonthlyPlanEndDate());

        // Essai réactivé
        assertFalse(organization.getTrialPermanentlyExpired());
        assertNotNull(organization.getTrialExpiresAt());

        // Logs effacés
        verify(usageLogRepository).deleteByOrganizationId(1L);

        // Sauvegarde et réactivation des collaborateurs
        verify(organizationRepository).save(organization);
        verify(collaboratorService).reactivateAllCollaborators(organization);

        assertNotNull(result);
    }

    @Test
    void testResetPlan_WhenOrganizationNotFound_ShouldThrowException() {
        when(organizationRepository.findById(1L)).thenReturn(Optional.empty());

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () ->
                planChangeService.resetPlan(1L));

        assertTrue(exception.getMessage().contains("Organisation non trouvée"));
        verify(organizationRepository, never()).save(any());
        verify(usageLogRepository, never()).deleteByOrganizationId(any());
        verify(collaboratorService, never()).reactivateAllCollaborators(any());
    }
}
