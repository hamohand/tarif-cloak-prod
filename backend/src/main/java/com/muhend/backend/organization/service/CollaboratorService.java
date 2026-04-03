package com.muhend.backend.organization.service;

import com.muhend.backend.auth.service.KeycloakAdminService;
import com.muhend.backend.organization.dto.OrganizationUserDto;
import com.muhend.backend.organization.dto.OrganizationMapper;
import com.muhend.backend.organization.model.Organization;
import com.muhend.backend.organization.model.OrganizationUser;
import com.muhend.backend.organization.repository.OrganizationRepository;
import com.muhend.backend.organization.repository.OrganizationUserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Service pour la gestion des collaborateurs au sein des organisations.
 */
@Service
@Slf4j
public class CollaboratorService {

    private final OrganizationRepository organizationRepository;
    private final OrganizationUserRepository organizationUserRepository;
    private final KeycloakAdminService keycloakAdminService;
    private final OrganizationMapper organizationMapper;

    public CollaboratorService(OrganizationRepository organizationRepository,
                               OrganizationUserRepository organizationUserRepository,
                               KeycloakAdminService keycloakAdminService,
                               OrganizationMapper organizationMapper) {
        this.organizationRepository = organizationRepository;
        this.organizationUserRepository = organizationUserRepository;
        this.keycloakAdminService = keycloakAdminService;
        this.organizationMapper = organizationMapper;
    }

    /**
     * Ajoute un utilisateur à une organisation.
     */
    @Transactional
    public OrganizationUserDto addUserToOrganization(Long organizationId, String keycloakUserId) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(
                        () -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + organizationId));

        if (organizationUserRepository.existsByOrganizationIdAndKeycloakUserId(organizationId, keycloakUserId)) {
            throw new IllegalArgumentException("L'utilisateur est déjà membre de cette organisation");
        }

        OrganizationUser organizationUser = new OrganizationUser();
        organizationUser.setOrganization(organization);
        organizationUser.setKeycloakUserId(keycloakUserId);
        organizationUser = organizationUserRepository.save(organizationUser);

        log.info("Utilisateur {} ajouté à l'organisation {} ({})",
                keycloakUserId, organizationId, organization.getName());

        return organizationMapper.toOrganizationUserDto(organizationUser);
    }

    /**
     * Retire un utilisateur d'une organisation.
     */
    @Transactional
    public void removeUserFromOrganization(Long organizationId, String keycloakUserId) {
        if (!organizationUserRepository.existsByOrganizationIdAndKeycloakUserId(organizationId, keycloakUserId)) {
            throw new IllegalArgumentException("L'utilisateur n'est pas membre de cette organisation");
        }

        organizationUserRepository.deleteByOrganizationIdAndKeycloakUserId(organizationId, keycloakUserId);
        log.info("Utilisateur {} retiré de l'organisation {}", keycloakUserId, organizationId);
    }

    /**
     * Désactive un collaborateur (désactive son compte Keycloak).
     */
    @Transactional
    public void disableCollaborator(Long organizationId, String keycloakUserId) {
        if (!organizationUserRepository.existsByOrganizationIdAndKeycloakUserId(organizationId, keycloakUserId)) {
            throw new IllegalArgumentException("Le collaborateur n'est pas membre de cette organisation");
        }

        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(
                        () -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + organizationId));
        if (keycloakUserId.equals(organization.getKeycloakUserId())) {
            throw new IllegalArgumentException("Impossible de désactiver le compte organisation lui-même");
        }

        try {
            keycloakAdminService.disableUser(keycloakUserId);
            log.info("Collaborateur {} désactivé dans Keycloak pour l'organisation {}", keycloakUserId, organizationId);
        } catch (Exception e) {
            log.error("Erreur lors de la désactivation du collaborateur {} dans Keycloak: {}", keycloakUserId,
                    e.getMessage(), e);
            throw new RuntimeException("Erreur lors de la désactivation du collaborateur: " + e.getMessage(), e);
        }
    }

    /**
     * Active un collaborateur (active son compte Keycloak).
     */
    @Transactional
    public void enableCollaborator(Long organizationId, String keycloakUserId) {
        if (!organizationUserRepository.existsByOrganizationIdAndKeycloakUserId(organizationId, keycloakUserId)) {
            throw new IllegalArgumentException("Le collaborateur n'est pas membre de cette organisation");
        }

        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(
                        () -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + organizationId));
        if (keycloakUserId.equals(organization.getKeycloakUserId())) {
            throw new IllegalArgumentException("Impossible d'activer le compte organisation lui-même (déjà actif)");
        }

        try {
            keycloakAdminService.enableUser(keycloakUserId);
            log.info("Collaborateur {} activé dans Keycloak pour l'organisation {}", keycloakUserId, organizationId);
        } catch (Exception e) {
            log.error("Erreur lors de l'activation du collaborateur {} dans Keycloak: {}", keycloakUserId,
                    e.getMessage(), e);
            throw new RuntimeException("Erreur lors de l'activation du collaborateur: " + e.getMessage(), e);
        }
    }

    /**
     * Supprime un collaborateur (retire de l'organisation et désactive son compte Keycloak).
     */
    @Transactional
    public void deleteCollaborator(Long organizationId, String keycloakUserId) {
        if (!organizationUserRepository.existsByOrganizationIdAndKeycloakUserId(organizationId, keycloakUserId)) {
            throw new IllegalArgumentException("Le collaborateur n'est pas membre de cette organisation");
        }

        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(
                        () -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + organizationId));
        if (keycloakUserId.equals(organization.getKeycloakUserId())) {
            throw new IllegalArgumentException("Impossible de supprimer le compte organisation lui-même");
        }

        organizationUserRepository.deleteByOrganizationIdAndKeycloakUserId(organizationId, keycloakUserId);
        log.info("Collaborateur {} retiré de l'organisation {}", keycloakUserId, organizationId);

        try {
            keycloakAdminService.disableUser(keycloakUserId);
            log.info("Compte Keycloak {} désactivé après suppression de l'organisation", keycloakUserId);
        } catch (Exception e) {
            log.warn("Erreur lors de la désactivation du compte Keycloak {}: {}", keycloakUserId, e.getMessage());
        }
    }

    /**
     * Suspend tous les collaborateurs d'une organisation en les désactivant dans Keycloak.
     */
    @Transactional
    public void suspendAllCollaborators(Organization organization) {
        List<OrganizationUser> collaborators = organizationUserRepository.findByOrganizationId(organization.getId());
        log.info("Suspension de {} collaborateurs pour l'organisation {}", collaborators.size(), organization.getId());

        for (OrganizationUser collaborator : collaborators) {
            try {
                if (!collaborator.getKeycloakUserId().equals(organization.getKeycloakUserId())) {
                    keycloakAdminService.disableUser(collaborator.getKeycloakUserId());
                    log.info("Collaborateur {} suspendu pour l'organisation {}",
                            collaborator.getKeycloakUserId(), organization.getId());
                } else {
                    log.debug("Le propriétaire de l'organisation {} n'est pas suspendu", organization.getId());
                }
            } catch (Exception e) {
                log.error("Erreur lors de la suspension du collaborateur {}: {}",
                        collaborator.getKeycloakUserId(), e.getMessage(), e);
            }
        }
    }

    /**
     * Réactive tous les collaborateurs d'une organisation en les activant dans Keycloak.
     */
    @Transactional
    public void reactivateAllCollaborators(Organization organization) {
        List<OrganizationUser> collaborators = organizationUserRepository.findByOrganizationId(organization.getId());
        log.info("Réactivation de {} collaborateurs pour l'organisation {}", collaborators.size(),
                organization.getId());

        for (OrganizationUser collaborator : collaborators) {
            try {
                keycloakAdminService.enableUser(collaborator.getKeycloakUserId());
                log.info("Collaborateur {} réactivé pour l'organisation {}",
                        collaborator.getKeycloakUserId(), organization.getId());
            } catch (Exception e) {
                log.error("Erreur lors de la réactivation du collaborateur {}: {}",
                        collaborator.getKeycloakUserId(), e.getMessage(), e);
            }
        }
    }
}
