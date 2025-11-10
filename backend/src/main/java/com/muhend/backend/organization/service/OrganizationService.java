package com.muhend.backend.organization.service;

import com.muhend.backend.auth.service.KeycloakAdminService;
import com.muhend.backend.organization.dto.CreateOrganizationRequest;
import com.muhend.backend.organization.dto.OrganizationDto;
import com.muhend.backend.organization.dto.OrganizationUserDto;
import com.muhend.backend.organization.exception.QuotaExceededException;
import com.muhend.backend.organization.model.Organization;
import com.muhend.backend.organization.model.OrganizationUser;
import com.muhend.backend.organization.repository.OrganizationRepository;
import com.muhend.backend.organization.repository.OrganizationUserRepository;
import com.muhend.backend.usage.repository.UsageLogRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Service pour gérer les organisations et les associations utilisateur-organisation.
 * Phase 2 MVP : Association Utilisateur → Entreprise
 */
@Service
@Slf4j
public class OrganizationService {
    
    private final OrganizationRepository organizationRepository;
    private final OrganizationUserRepository organizationUserRepository;
    private final UsageLogRepository usageLogRepository;
    private final KeycloakAdminService keycloakAdminService;
    
    public OrganizationService(OrganizationRepository organizationRepository,
                              OrganizationUserRepository organizationUserRepository,
                              UsageLogRepository usageLogRepository,
                              KeycloakAdminService keycloakAdminService) {
        this.organizationRepository = organizationRepository;
        this.organizationUserRepository = organizationUserRepository;
        this.usageLogRepository = usageLogRepository;
        this.keycloakAdminService = keycloakAdminService;
    }
    
    /**
     * Crée une nouvelle organisation.
     */
    @Transactional
    public OrganizationDto createOrganization(CreateOrganizationRequest request) {
        // Vérifier si une organisation avec ce nom existe déjà
        if (organizationRepository.existsByName(request.getName())) {
            throw new IllegalArgumentException("Une organisation avec le nom '" + request.getName() + "' existe déjà");
        }
        
        // Vérifier si une organisation avec cet email existe déjà (email est obligatoire et unique)
        if (organizationRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Une organisation avec l'email '" + request.getEmail() + "' existe déjà");
        }
        
        Organization organization = new Organization();
        organization.setName(request.getName());
        organization.setEmail(request.getEmail().trim());
        organization = organizationRepository.save(organization);
        
        log.info("Organisation créée: id={}, name={}, email={}", organization.getId(), organization.getName(), organization.getEmail());
        return toDto(organization);
    }
    
    /**
     * Met à jour une organisation.
     */
    @Transactional
    public OrganizationDto updateOrganization(Long id, String name, String email) {
        Organization organization = organizationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + id));
        
        // Vérifier si le nom change et si le nouveau nom existe déjà
        if (name != null && !name.trim().isEmpty() && !name.equals(organization.getName())) {
            if (organizationRepository.existsByName(name)) {
                throw new IllegalArgumentException("Une organisation avec le nom '" + name + "' existe déjà");
            }
            organization.setName(name.trim());
        }
        
        // Vérifier si l'email change et si le nouvel email existe déjà
        if (email != null && !email.trim().isEmpty()) {
            String trimmedEmail = email.trim();
            if (!trimmedEmail.equals(organization.getEmail())) {
                if (organizationRepository.existsByEmail(trimmedEmail)) {
                    throw new IllegalArgumentException("Une organisation avec l'email '" + trimmedEmail + "' existe déjà");
                }
                organization.setEmail(trimmedEmail);
            }
        } else if (email != null && email.trim().isEmpty()) {
            // Permettre de mettre l'email à null en envoyant une chaîne vide
            organization.setEmail(null);
        }
        
        organization = organizationRepository.save(organization);
        log.info("Organisation mise à jour: id={}, name={}, email={}", organization.getId(), organization.getName(), organization.getEmail());
        return toDto(organization);
    }
    
    /**
     * Récupère toutes les organisations.
     */
    public List<OrganizationDto> getAllOrganizations() {
        return organizationRepository.findAll().stream()
                .map(this::toDtoWithUserCount)
                .collect(Collectors.toList());
    }
    
    /**
     * Récupère une organisation par son ID.
     */
    public OrganizationDto getOrganizationById(Long id) {
        Organization organization = organizationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + id));
        return toDtoWithUserCount(organization);
    }
    
    /**
     * Ajoute un utilisateur à une organisation.
     */
    @Transactional
    public OrganizationUserDto addUserToOrganization(Long organizationId, String keycloakUserId) {
        // Vérifier que l'organisation existe
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + organizationId));
        
        // Vérifier si l'utilisateur est déjà dans cette organisation
        if (organizationUserRepository.existsByOrganizationIdAndKeycloakUserId(organizationId, keycloakUserId)) {
            throw new IllegalArgumentException("L'utilisateur est déjà membre de cette organisation");
        }
        
        OrganizationUser organizationUser = new OrganizationUser();
        organizationUser.setOrganization(organization);
        organizationUser.setKeycloakUserId(keycloakUserId);
        organizationUser = organizationUserRepository.save(organizationUser);
        
        log.info("Utilisateur {} ajouté à l'organisation {} ({})", 
                keycloakUserId, organizationId, organization.getName());
        
        return toOrganizationUserDto(organizationUser);
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
     * Récupère toutes les organisations d'un utilisateur.
     */
    public List<OrganizationDto> getOrganizationsByUser(String keycloakUserId) {
        return organizationUserRepository.findByKeycloakUserId(keycloakUserId).stream()
                .map(ou -> toDto(ou.getOrganization()))
                .collect(Collectors.toList());
    }
    
    /**
     * Récupère tous les utilisateurs d'une organisation.
     */
    public List<OrganizationUserDto> getUsersByOrganization(Long organizationId) {
        return organizationUserRepository.findByOrganizationId(organizationId).stream()
                .map(this::toOrganizationUserDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Récupère l'ID de l'organisation d'un utilisateur (première organisation trouvée).
     * Pour la Phase 2, on suppose qu'un utilisateur n'a qu'une seule organisation.
     * @return L'ID de l'organisation ou null si l'utilisateur n'a pas d'organisation
     */
    public Long getOrganizationIdByUserId(String keycloakUserId) {
        List<OrganizationUser> organizationUsers = organizationUserRepository.findByKeycloakUserId(keycloakUserId);
        if (organizationUsers.isEmpty()) {
            return null; // L'utilisateur n'a pas d'organisation
        }
        // Retourner la première organisation (on pourra améliorer cela plus tard)
        Organization organization = organizationUsers.get(0).getOrganization();
        return organization != null ? organization.getId() : null;
    }
    
    /**
     * Vérifie si un utilisateur appartient à une organisation.
     */
    public boolean isUserInOrganization(String keycloakUserId, Long organizationId) {
        return organizationUserRepository.existsByOrganizationIdAndKeycloakUserId(organizationId, keycloakUserId);
    }
    
    /**
     * Vérifie si le quota mensuel d'une organisation est dépassé.
     * Si monthlyQuota est null, le quota est illimité et cette méthode retourne toujours true.
     * Phase 4 MVP : Quotas Basiques
     * 
     * @param organizationId ID de l'organisation
     * @return true si le quota n'est pas dépassé, false sinon
     * @throws QuotaExceededException si le quota est dépassé
     */
    public boolean checkQuota(Long organizationId) {
        if (organizationId == null) {
            // Si l'organisation est null, on autorise (utilisateur sans organisation)
            return true;
        }
        
        Organization organization = organizationRepository.findById(organizationId)
                .orElse(null);
        
        if (organization == null) {
            // Organisation non trouvée, on autorise (non bloquant)
            log.warn("Organisation {} non trouvée lors de la vérification du quota", organizationId);
            return true;
        }
        
        Integer monthlyQuota = organization.getMonthlyQuota();
        
        // Si le quota est null, il est illimité
        if (monthlyQuota == null) {
            return true;
        }
        
        // Calculer le début et la fin du mois en cours
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startOfMonth = now.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime endOfMonth = now.withDayOfMonth(now.toLocalDate().lengthOfMonth())
                .withHour(23).withMinute(59).withSecond(59).withNano(999999999);
        
        // Compter les requêtes du mois en cours
        long currentUsage = usageLogRepository.countByOrganizationIdAndTimestampBetween(
                organizationId, startOfMonth, endOfMonth);
        
        // Vérifier si le quota est dépassé
        if (currentUsage >= monthlyQuota) {
            String message = String.format(
                    "Quota mensuel dépassé pour l'organisation '%s' (ID: %d). Utilisation: %d/%d requêtes",
                    organization.getName(), organizationId, currentUsage, monthlyQuota);
            log.warn(message);
            throw new QuotaExceededException(message);
        }
        
        log.debug("Quota OK pour l'organisation {}: {}/{} requêtes utilisées ce mois", 
                 organizationId, currentUsage, monthlyQuota);
        return true;
    }
    
    /**
     * Met à jour le quota mensuel d'une organisation.
     * Phase 4 MVP : Quotas Basiques
     * 
     * @param organizationId ID de l'organisation
     * @param monthlyQuota Nouveau quota mensuel (null pour quota illimité)
     * @return L'organisation mise à jour
     */
    @Transactional
    public OrganizationDto updateMonthlyQuota(Long organizationId, Integer monthlyQuota) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + organizationId));
        
        organization.setMonthlyQuota(monthlyQuota);
        organization = organizationRepository.save(organization);
        
        log.info("Quota mensuel mis à jour pour l'organisation {} (ID: {}): {} requêtes/mois", 
                organization.getName(), organizationId, monthlyQuota != null ? monthlyQuota : "illimité");
        
        return toDto(organization);
    }
    
    /**
     * Convertit une Organisation en DTO.
     */
    private OrganizationDto toDto(Organization organization) {
        OrganizationDto dto = new OrganizationDto();
        dto.setId(organization.getId());
        dto.setName(organization.getName());
        dto.setEmail(organization.getEmail());
        dto.setMonthlyQuota(organization.getMonthlyQuota());
        dto.setCreatedAt(organization.getCreatedAt());
        return dto;
    }
    
    /**
     * Convertit une Organisation en DTO avec le nombre d'utilisateurs et l'utilisation du mois.
     */
    private OrganizationDto toDtoWithUserCount(Organization organization) {
        OrganizationDto dto = toDto(organization);
        long userCount = organizationUserRepository.findByOrganizationId(organization.getId()).size();
        dto.setUserCount(userCount);
        
        // Calculer l'utilisation du mois en cours
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startOfMonth = now.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime endOfMonth = now.withDayOfMonth(now.toLocalDate().lengthOfMonth())
                .withHour(23).withMinute(59).withSecond(59).withNano(999999999);
        long currentMonthUsage = usageLogRepository.countByOrganizationIdAndTimestampBetween(organization.getId(), startOfMonth, endOfMonth);
        dto.setCurrentMonthUsage(currentMonthUsage);
        
        return dto;
    }
    
    /**
     * Convertit une OrganizationUser en DTO.
     */
    private OrganizationUserDto toOrganizationUserDto(OrganizationUser organizationUser) {
        OrganizationUserDto dto = new OrganizationUserDto();
        dto.setId(organizationUser.getId());
        dto.setOrganizationId(organizationUser.getOrganization().getId());
        dto.setOrganizationName(organizationUser.getOrganization().getName());
        dto.setKeycloakUserId(organizationUser.getKeycloakUserId());
        
        // Récupérer le nom d'utilisateur depuis Keycloak
        try {
            String username = keycloakAdminService.getUsername(organizationUser.getKeycloakUserId());
            dto.setUsername(username != null ? username : "N/A");
        } catch (Exception e) {
            log.warn("Impossible de récupérer le nom d'utilisateur pour {}: {}", 
                organizationUser.getKeycloakUserId(), e.getMessage());
            dto.setUsername("N/A");
        }
        
        dto.setJoinedAt(organizationUser.getJoinedAt());
        return dto;
    }
}

