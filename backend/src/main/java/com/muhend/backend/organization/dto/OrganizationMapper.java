package com.muhend.backend.organization.dto;

import com.muhend.backend.auth.service.KeycloakAdminService;
import com.muhend.backend.organization.model.Organization;
import com.muhend.backend.organization.model.OrganizationUser;
import com.muhend.backend.organization.repository.OrganizationUserRepository;
import com.muhend.backend.usage.model.UsageLog;
import com.muhend.backend.usage.repository.UsageLogRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Mapper pour convertir les entités Organisation en DTO.
 */
@Component
@Slf4j
public class OrganizationMapper {

    private final OrganizationUserRepository organizationUserRepository;
    private final KeycloakAdminService keycloakAdminService;
    private final UsageLogRepository usageLogRepository;

    @Value("${credits.positions10:15}")
    private int creditsPositions10;
    @Value("${credits.positions6:10}")
    private int creditsPositions6;
    @Value("${credits.decode-p10:5}")
    private int creditsDecodep10;
    @Value("${credits.decode:2}")
    private int creditsDecode;
    @Value("${credits.default:1}")
    private int creditsDefault;

    public OrganizationMapper(OrganizationUserRepository organizationUserRepository,
                              KeycloakAdminService keycloakAdminService,
                              UsageLogRepository usageLogRepository) {
        this.organizationUserRepository = organizationUserRepository;
        this.keycloakAdminService = keycloakAdminService;
        this.usageLogRepository = usageLogRepository;
    }

    /**
     * Convertit une Organisation en DTO.
     */
    public OrganizationDto toDto(Organization organization) {
        OrganizationDto dto = new OrganizationDto();
        dto.setId(organization.getId());
        dto.setName(organization.getName());
        dto.setEmail(organization.getEmail());
        dto.setAddress(organization.getAddress());
        dto.setActivityDomain(organization.getActivityDomain());
        dto.setCountry(organization.getCountry());
        dto.setPhone(organization.getPhone());
        dto.setMonthlyQuota(organization.getMonthlyQuota());
        dto.setPricingPlanId(organization.getPricingPlanId());
        dto.setMarketVersion(organization.getMarketVersion());
        dto.setTrialExpiresAt(organization.getTrialExpiresAt());
        dto.setTrialPermanentlyExpired(organization.getTrialPermanentlyExpired());
        dto.setMonthlyPlanStartDate(organization.getMonthlyPlanStartDate());
        dto.setMonthlyPlanEndDate(organization.getMonthlyPlanEndDate());
        dto.setPendingMonthlyPlanId(organization.getPendingMonthlyPlanId());
        dto.setPendingMonthlyPlanChangeDate(organization.getPendingMonthlyPlanChangeDate());
        dto.setLastPayPerRequestInvoiceDate(organization.getLastPayPerRequestInvoiceDate());
        dto.setPendingPayPerRequestPlanId(organization.getPendingPayPerRequestPlanId());
        dto.setPendingPayPerRequestChangeDate(organization.getPendingPayPerRequestChangeDate());
        dto.setEnabled(organization.getEnabled());
        dto.setCreatedAt(organization.getCreatedAt());
        return dto;
    }

    /**
     * Convertit une Organisation en DTO avec le nombre d'utilisateurs et l'utilisation du mois.
     */
    public OrganizationDto toDtoWithUserCount(Organization organization) {
        OrganizationDto dto = toDto(organization);
        long userCount = organizationUserRepository.findByOrganizationId(organization.getId()).size();
        dto.setUserCount(userCount);

        // Calculer les crédits consommés ce cycle/mois
        LocalDateTime startDateTime;
        LocalDateTime endDateTime;
        if (organization.getMonthlyPlanStartDate() != null && organization.getMonthlyPlanEndDate() != null) {
            startDateTime = organization.getMonthlyPlanStartDate().atStartOfDay();
            endDateTime = organization.getMonthlyPlanEndDate().atTime(23, 59, 59, 999999999);
        } else {
            LocalDateTime now = LocalDateTime.now();
            startDateTime = now.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
            endDateTime = now.withDayOfMonth(now.toLocalDate().lengthOfMonth())
                    .withHour(23).withMinute(59).withSecond(59).withNano(999999999);
        }
        long currentMonthUsage = computeCredits(usageLogRepository
                .findByOrganizationIdAndTimestampBetween(organization.getId(), startDateTime, endDateTime));
        dto.setCurrentMonthUsage(currentMonthUsage);

        return dto;
    }

    /**
     * Convertit une OrganizationUser en DTO.
     */
    public OrganizationUserDto toOrganizationUserDto(OrganizationUser organizationUser) {
        OrganizationUserDto dto = new OrganizationUserDto();
        dto.setId(organizationUser.getId());
        dto.setOrganizationId(organizationUser.getOrganization().getId());
        dto.setOrganizationName(organizationUser.getOrganization().getName());
        dto.setKeycloakUserId(organizationUser.getKeycloakUserId());

        dto.setEmail(null);
        dto.setFirstName(null);
        dto.setLastName(null);
        dto.setEnabled(null);
        try {
            var userRepresentation = keycloakAdminService.getUserRepresentation(organizationUser.getKeycloakUserId());
            if (userRepresentation != null) {
                dto.setUsername(userRepresentation.getUsername());
                dto.setEmail(userRepresentation.getEmail());
                dto.setFirstName(userRepresentation.getFirstName());
                dto.setLastName(userRepresentation.getLastName());
                dto.setEnabled(userRepresentation.isEnabled() != null && userRepresentation.isEnabled());
            } else {
                dto.setUsername("N/A");
                dto.setEnabled(false);
            }
        } catch (Exception e) {
            log.warn("Impossible de récupérer les informations utilisateur pour {}: {}",
                    organizationUser.getKeycloakUserId(), e.getMessage());
            dto.setUsername("N/A");
            dto.setEnabled(false);
        }

        dto.setJoinedAt(organizationUser.getJoinedAt());
        return dto;
    }

    /**
     * Calcule la somme de crédits consommés à partir d'une liste de logs d'utilisation.
     */
    public long computeCredits(List<UsageLog> logs) {
        return logs.stream().mapToLong(log -> {
            String ep = log.getEndpoint();
            if (ep == null)
                return creditsDefault;
            if (ep.contains("positions10"))
                return creditsPositions10;
            if (ep.contains("positions6"))
                return creditsPositions6;
            if (ep.contains("decode-p10"))
                return creditsDecodep10;
            if (ep.contains("decode"))
                return creditsDecode;
            return creditsDefault;
        }).sum();
    }
}
