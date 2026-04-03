package com.muhend.backend.organization.service;

import com.muhend.backend.auth.service.KeycloakAdminService;
import com.muhend.backend.email.service.EmailService;
import com.muhend.backend.organization.dto.CreateOrganizationRequest;
import com.muhend.backend.organization.dto.OrganizationDto;
import com.muhend.backend.organization.dto.OrganizationMapper;
import com.muhend.backend.organization.dto.OrganizationUserDto;
import com.muhend.backend.organization.dto.UpdateOrganizationRequest;
import com.muhend.backend.organization.exception.UserNotAssociatedException;
import com.muhend.backend.organization.model.Organization;
import com.muhend.backend.organization.model.OrganizationUser;
import com.muhend.backend.organization.repository.OrganizationRepository;
import com.muhend.backend.organization.repository.OrganizationUserRepository;
import com.muhend.backend.pricing.service.PricingPlanService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service CRUD pour les organisations et résolution utilisateur → organisation.
 * <p>
 * Les responsabilités suivantes ont été extraites dans des services dédiés :
 * <ul>
 *   <li>{@link QuotaService} — vérification des quotas et calcul des crédits</li>
 *   <li>{@link PlanChangeService} — changement de plan tarifaire, essai, accès</li>
 *   <li>{@link CollaboratorService} — gestion des collaborateurs</li>
 *   <li>{@link OrganizationMapper} — conversion Entity ↔ DTO</li>
 * </ul>
 */
@Service
@Slf4j
public class OrganizationService {

    private final OrganizationRepository organizationRepository;
    private final OrganizationUserRepository organizationUserRepository;
    private final KeycloakAdminService keycloakAdminService;
    private final PricingPlanService pricingPlanService;
    private final EmailService emailService;
    private final OrganizationMapper organizationMapper;

    public OrganizationService(OrganizationRepository organizationRepository,
            OrganizationUserRepository organizationUserRepository,
            KeycloakAdminService keycloakAdminService,
            PricingPlanService pricingPlanService,
            EmailService emailService,
            OrganizationMapper organizationMapper) {
        this.organizationRepository = organizationRepository;
        this.organizationUserRepository = organizationUserRepository;
        this.keycloakAdminService = keycloakAdminService;
        this.pricingPlanService = pricingPlanService;
        this.emailService = emailService;
        this.organizationMapper = organizationMapper;
    }

    // =====================================================================
    //  CRUD Organisations
    // =====================================================================

    /**
     * Crée une nouvelle organisation.
     */
    @Transactional
    public OrganizationDto createOrganization(CreateOrganizationRequest request) {
        if (organizationRepository.existsByName(request.getName())) {
            throw new IllegalArgumentException("Une organisation avec le nom '" + request.getName() + "' existe déjà");
        }

        if (organizationRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException(
                    "Une organisation avec l'email '" + request.getEmail() + "' existe déjà");
        }

        Organization organization = new Organization();
        organization.setName(request.getName());
        organization.setEmail(request.getEmail().trim());
        organization.setAddress(request.getAddress().trim());
        if (request.getActivityDomain() != null && !request.getActivityDomain().trim().isEmpty()) {
            organization.setActivityDomain(request.getActivityDomain().trim());
        }
        organization.setCountry(request.getCountry().trim().toUpperCase());
        organization.setPhone(request.getPhone().trim());
        if (request.getKeycloakUserId() != null && !request.getKeycloakUserId().trim().isEmpty()) {
            organization.setKeycloakUserId(request.getKeycloakUserId().trim());
        }
        if (request.getMarketVersion() != null && !request.getMarketVersion().trim().isEmpty()) {
            organization.setMarketVersion(request.getMarketVersion().trim());
        }

        // Si un plan tarifaire est spécifié, le valider et l'associer
        if (request.getPricingPlanId() != null) {
            try {
                var plan = pricingPlanService.getPricingPlanById(request.getPricingPlanId());
                organization.setPricingPlanId(request.getPricingPlanId());
                if (plan.getMonthlyQuota() != null) {
                    organization.setMonthlyQuota(plan.getMonthlyQuota());
                }
                if (plan.getTrialPeriodDays() != null && plan.getTrialPeriodDays() > 0) {
                    organization.setTrialExpiresAt(LocalDateTime.now().plusDays(plan.getTrialPeriodDays()));
                    log.info("Plan d'essai activé pour l'organisation {}: expiration dans {} jours",
                            organization.getName(), plan.getTrialPeriodDays());
                }
            } catch (IllegalArgumentException e) {
                log.warn("Plan tarifaire invalide {}: {}", request.getPricingPlanId(), e.getMessage());
                throw new IllegalArgumentException("Plan tarifaire invalide: " + e.getMessage());
            }
        }

        organization = organizationRepository.save(organization);

        log.info("Organisation créée: id={}, name={}, email={}, pricingPlanId={}",
                organization.getId(), organization.getName(), organization.getEmail(), organization.getPricingPlanId());

        // Envoyer une notification à l'administrateur
        try {
            String adminEmail = System.getenv("EMAIL_ADMIN_HSCODE");
            if (adminEmail != null && !adminEmail.trim().isEmpty()) {
                emailService.sendNewOrganizationNotificationEmail(
                        adminEmail.trim(),
                        organization.getName(),
                        organization.getAddress());
            } else {
                log.debug("EMAIL_ADMIN_HSCODE non configuré, notification admin non envoyée");
            }
        } catch (Exception e) {
            log.warn("Erreur lors de l'envoi de la notification admin pour la nouvelle organisation {}: {}",
                    organization.getName(), e.getMessage());
        }

        return organizationMapper.toDto(organization);
    }

    /**
     * Met à jour une organisation.
     */
    @Transactional
    public OrganizationDto updateOrganization(Long id, UpdateOrganizationRequest request) {
        Organization organization = organizationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + id));

        String name = request.getName();
        if (name != null && !name.trim().isEmpty() && !name.equals(organization.getName())) {
            if (organizationRepository.existsByName(name)) {
                throw new IllegalArgumentException("Une organisation avec le nom '" + name + "' existe déjà");
            }
            organization.setName(name.trim());
        }

        String email = request.getEmail();
        if (email != null && !email.trim().isEmpty()) {
            String trimmedEmail = email.trim();
            if (!trimmedEmail.equals(organization.getEmail())) {
                if (organizationRepository.existsByEmail(trimmedEmail)) {
                    throw new IllegalArgumentException(
                            "Une organisation avec l'email '" + trimmedEmail + "' existe déjà");
                }
                organization.setEmail(trimmedEmail);
            }
        } else if (email != null && email.trim().isEmpty()) {
            organization.setEmail(null);
        }

        if (request.getAddress() != null && !request.getAddress().trim().isEmpty()) {
            organization.setAddress(request.getAddress().trim());
        }

        if (request.getActivityDomain() != null && !request.getActivityDomain().trim().isEmpty()) {
            organization.setActivityDomain(request.getActivityDomain().trim());
        } else if (request.getActivityDomain() != null && request.getActivityDomain().trim().isEmpty()) {
            organization.setActivityDomain(null);
        }

        if (request.getCountry() != null && !request.getCountry().trim().isEmpty()) {
            organization.setCountry(request.getCountry().trim().toUpperCase());
        }

        if (request.getPhone() != null && !request.getPhone().trim().isEmpty()) {
            organization.setPhone(request.getPhone().trim());
        }

        organization = organizationRepository.save(organization);
        log.info("Organisation mise à jour: id={}, name={}, email={}", organization.getId(), organization.getName(),
                organization.getEmail());
        return organizationMapper.toDto(organization);
    }

    /**
     * Récupère toutes les organisations.
     */
    public List<OrganizationDto> getAllOrganizations() {
        return organizationRepository.findAll().stream()
                .map(organizationMapper::toDtoWithUserCount)
                .collect(Collectors.toList());
    }

    /**
     * Récupère une organisation par son ID.
     */
    public OrganizationDto getOrganizationById(Long id) {
        Organization organization = organizationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + id));
        return organizationMapper.toDtoWithUserCount(organization);
    }

    public OrganizationDto getOrganizationByKeycloakUserId(String keycloakUserId) {
        Organization organization = organizationRepository.findByKeycloakUserId(keycloakUserId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Organisation non trouvée pour cet identifiant utilisateur."));
        return organizationMapper.toDtoWithUserCount(organization);
    }

    // =====================================================================
    //  Résolution Utilisateur → Organisation
    // =====================================================================

    public List<OrganizationUserDto> getOrganizationUsersByKeycloakUserId(String keycloakUserId) {
        Organization organization = organizationRepository.findByKeycloakUserId(keycloakUserId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Organisation non trouvée pour cet identifiant utilisateur."));
        String ownerKeycloakUserId = organization.getKeycloakUserId();
        return organizationUserRepository.findByOrganizationId(organization.getId()).stream()
                .map(ou -> {
                    OrganizationUserDto dto = organizationMapper.toOrganizationUserDto(ou);
                    dto.setIsOwner(ownerKeycloakUserId != null && ownerKeycloakUserId.equals(ou.getKeycloakUserId()));
                    return dto;
                })
                .collect(Collectors.toList());
    }

    /**
     * Récupère toutes les organisations d'un utilisateur.
     */
    public List<OrganizationDto> getOrganizationsByUser(String keycloakUserId) {
        return organizationUserRepository.findByKeycloakUserId(keycloakUserId).stream()
                .map(ou -> organizationMapper.toDto(ou.getOrganization()))
                .collect(Collectors.toList());
    }

    /**
     * Récupère tous les utilisateurs d'une organisation.
     */
    public List<OrganizationUserDto> getUsersByOrganization(Long organizationId) {
        return organizationUserRepository.findByOrganizationId(organizationId).stream()
                .map(organizationMapper::toOrganizationUserDto)
                .collect(Collectors.toList());
    }

    /**
     * Récupère l'ID de l'organisation d'un utilisateur.
     * Un utilisateur DOIT toujours être associé à une organisation.
     *
     * @param keycloakUserId ID Keycloak de l'utilisateur
     * @return L'ID de l'organisation
     * @throws UserNotAssociatedException si l'utilisateur n'a pas d'organisation
     */
    public Long getOrganizationIdByUserId(String keycloakUserId) {
        List<OrganizationUser> organizationUsers = organizationUserRepository.findByKeycloakUserId(keycloakUserId);
        if (organizationUsers.isEmpty()) {
            Optional<Organization> organizationByOwner = organizationRepository.findByKeycloakUserId(keycloakUserId);
            if (organizationByOwner.isPresent()) {
                Organization organization = organizationByOwner.get();
                if (!organizationUserRepository.existsByOrganizationIdAndKeycloakUserId(organization.getId(),
                        keycloakUserId)) {
                    OrganizationUser organizationUser = new OrganizationUser();
                    organizationUser.setOrganization(organization);
                    organizationUser.setKeycloakUserId(keycloakUserId);
                    organizationUserRepository.save(organizationUser);
                }
                return organization.getId();
            }
            throw new UserNotAssociatedException(
                    keycloakUserId,
                    "L'utilisateur doit être associé à une organisation. Aucune organisation trouvée.");
        }
        Organization organization = organizationUsers.get(0).getOrganization();
        if (organization == null) {
            throw new UserNotAssociatedException(
                    keycloakUserId,
                    "L'organisation associée à l'utilisateur est invalide.");
        }
        return organization.getId();
    }

    /**
     * Vérifie si un utilisateur appartient à une organisation.
     */
    public boolean isUserInOrganization(String keycloakUserId, Long organizationId) {
        return organizationUserRepository.existsByOrganizationIdAndKeycloakUserId(organizationId, keycloakUserId);
    }

    // =====================================================================
    //  Activation / Désactivation d'organisations
    // =====================================================================

    /**
     * Désactive une organisation.
     */
    @Transactional
    public OrganizationDto disableOrganization(Long organizationId) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(
                        () -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + organizationId));

        if (!Boolean.TRUE.equals(organization.getEnabled())) {
            throw new IllegalArgumentException("L'organisation est déjà désactivée");
        }

        organization.setEnabled(false);
        organization = organizationRepository.save(organization);

        log.info("Organisation {} (ID: {}) désactivée par un administrateur", organization.getName(), organizationId);

        return organizationMapper.toDtoWithUserCount(organization);
    }

    /**
     * Réactive une organisation.
     */
    @Transactional
    public OrganizationDto enableOrganization(Long organizationId) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(
                        () -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + organizationId));

        if (Boolean.TRUE.equals(organization.getEnabled())) {
            throw new IllegalArgumentException("L'organisation est déjà activée");
        }

        organization.setEnabled(true);
        organization = organizationRepository.save(organization);

        log.info("Organisation {} (ID: {}) réactivée par un administrateur", organization.getName(), organizationId);

        return organizationMapper.toDtoWithUserCount(organization);
    }

    // =====================================================================
    //  Suppression (redirige vers DeletionService)
    // =====================================================================

    /**
     * @deprecated Utiliser OrganizationDeletionService.deleteOrganization à la place.
     */
    @Deprecated
    @Transactional
    public void deleteOrganization(Long id) {
        log.error(
                "OrganizationService.deleteOrganization ne doit plus être utilisé. Utilisez OrganizationDeletionService à la place pour éviter les FK constraint errors.");
        throw new UnsupportedOperationException("Utilisez OrganizationDeletionService.deleteOrganization");
    }
}
