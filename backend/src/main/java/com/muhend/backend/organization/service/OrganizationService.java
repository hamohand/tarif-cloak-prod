package com.muhend.backend.organization.service;

import com.muhend.backend.auth.service.KeycloakAdminService;
import com.muhend.backend.email.service.EmailService;
import com.muhend.backend.invoice.service.InvoiceService;
import com.muhend.backend.organization.dto.CreateOrganizationRequest;
import com.muhend.backend.organization.dto.OrganizationDto;
import com.muhend.backend.organization.dto.OrganizationUserDto;
import com.muhend.backend.organization.dto.UpdateOrganizationRequest;
import com.muhend.backend.organization.exception.QuotaExceededException;
import com.muhend.backend.organization.exception.UserNotAssociatedException;
import com.muhend.backend.organization.model.Organization;
import com.muhend.backend.organization.model.OrganizationUser;
import com.muhend.backend.organization.repository.OrganizationRepository;
import com.muhend.backend.organization.repository.OrganizationUserRepository;
import com.muhend.backend.pricing.dto.PricingPlanDto;
import com.muhend.backend.pricing.service.PricingPlanService;
import com.muhend.backend.usage.repository.UsageLogRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
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
    private final PricingPlanService pricingPlanService;
    private final EmailService emailService;
    private final InvoiceService invoiceService;
    
    public OrganizationService(OrganizationRepository organizationRepository,
                              OrganizationUserRepository organizationUserRepository,
                              UsageLogRepository usageLogRepository,
                              KeycloakAdminService keycloakAdminService,
                              PricingPlanService pricingPlanService,
                              EmailService emailService,
                              InvoiceService invoiceService) {
        this.organizationRepository = organizationRepository;
        this.organizationUserRepository = organizationUserRepository;
        this.usageLogRepository = usageLogRepository;
        this.keycloakAdminService = keycloakAdminService;
        this.pricingPlanService = pricingPlanService;
        this.emailService = emailService;
        this.invoiceService = invoiceService;
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
                // Le quota peut être défini par le plan tarifaire
                if (plan.getMonthlyQuota() != null) {
                    organization.setMonthlyQuota(plan.getMonthlyQuota());
                }
                // Si c'est un plan d'essai, définir la date d'expiration
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
        return toDto(organization);
    }
    
    /**
     * Met à jour une organisation.
     */
    @Transactional
    public OrganizationDto updateOrganization(Long id, UpdateOrganizationRequest request) {
        Organization organization = organizationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + id));
        
        // Vérifier si le nom change et si le nouveau nom existe déjà
        String name = request.getName();
        if (name != null && !name.trim().isEmpty() && !name.equals(organization.getName())) {
            if (organizationRepository.existsByName(name)) {
                throw new IllegalArgumentException("Une organisation avec le nom '" + name + "' existe déjà");
            }
            organization.setName(name.trim());
        }
        
        // Vérifier si l'email change et si le nouvel email existe déjà
        String email = request.getEmail();
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
    
    public OrganizationDto getOrganizationByKeycloakUserId(String keycloakUserId) {
        Organization organization = organizationRepository.findByKeycloakUserId(keycloakUserId)
                .orElseThrow(() -> new IllegalArgumentException("Organisation non trouvée pour cet identifiant utilisateur."));
        return toDtoWithUserCount(organization);
    }

    public List<OrganizationUserDto> getOrganizationUsersByKeycloakUserId(String keycloakUserId) {
        Organization organization = organizationRepository.findByKeycloakUserId(keycloakUserId)
                .orElseThrow(() -> new IllegalArgumentException("Organisation non trouvée pour cet identifiant utilisateur."));
        return organizationUserRepository.findByOrganizationId(organization.getId()).stream()
                .map(this::toOrganizationUserDto)
                .collect(Collectors.toList());
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
     * Désactive un collaborateur (désactive son compte Keycloak).
     */
    @Transactional
    public void disableCollaborator(Long organizationId, String keycloakUserId) {
        // Vérifier que le collaborateur appartient à l'organisation
        if (!organizationUserRepository.existsByOrganizationIdAndKeycloakUserId(organizationId, keycloakUserId)) {
            throw new IllegalArgumentException("Le collaborateur n'est pas membre de cette organisation");
        }
        
        // Vérifier que ce n'est pas le compte organisation lui-même
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + organizationId));
        if (keycloakUserId.equals(organization.getKeycloakUserId())) {
            throw new IllegalArgumentException("Impossible de désactiver le compte organisation lui-même");
        }
        
        // Désactiver le compte Keycloak
        try {
            keycloakAdminService.disableUser(keycloakUserId);
            log.info("Collaborateur {} désactivé dans Keycloak pour l'organisation {}", keycloakUserId, organizationId);
        } catch (Exception e) {
            log.error("Erreur lors de la désactivation du collaborateur {} dans Keycloak: {}", keycloakUserId, e.getMessage(), e);
            throw new RuntimeException("Erreur lors de la désactivation du collaborateur: " + e.getMessage(), e);
        }
    }

    /**
     * Active un collaborateur (active son compte Keycloak).
     */
    @Transactional
    public void enableCollaborator(Long organizationId, String keycloakUserId) {
        // Vérifier que le collaborateur appartient à l'organisation
        if (!organizationUserRepository.existsByOrganizationIdAndKeycloakUserId(organizationId, keycloakUserId)) {
            throw new IllegalArgumentException("Le collaborateur n'est pas membre de cette organisation");
        }
        
        // Vérifier que ce n'est pas le compte organisation lui-même
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + organizationId));
        if (keycloakUserId.equals(organization.getKeycloakUserId())) {
            throw new IllegalArgumentException("Impossible d'activer le compte organisation lui-même (déjà actif)");
        }
        
        // Activer le compte Keycloak
        try {
            keycloakAdminService.enableUser(keycloakUserId);
            log.info("Collaborateur {} activé dans Keycloak pour l'organisation {}", keycloakUserId, organizationId);
        } catch (Exception e) {
            log.error("Erreur lors de l'activation du collaborateur {} dans Keycloak: {}", keycloakUserId, e.getMessage(), e);
            throw new RuntimeException("Erreur lors de l'activation du collaborateur: " + e.getMessage(), e);
        }
    }
    
    /**
     * Supprime un collaborateur (retire de l'organisation et supprime son compte Keycloak).
     */
    @Transactional
    public void deleteCollaborator(Long organizationId, String keycloakUserId) {
        // Vérifier que le collaborateur appartient à l'organisation
        if (!organizationUserRepository.existsByOrganizationIdAndKeycloakUserId(organizationId, keycloakUserId)) {
            throw new IllegalArgumentException("Le collaborateur n'est pas membre de cette organisation");
        }
        
        // Vérifier que ce n'est pas le compte organisation lui-même
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + organizationId));
        if (keycloakUserId.equals(organization.getKeycloakUserId())) {
            throw new IllegalArgumentException("Impossible de supprimer le compte organisation lui-même");
        }
        
        // Retirer de l'organisation
        organizationUserRepository.deleteByOrganizationIdAndKeycloakUserId(organizationId, keycloakUserId);
        log.info("Collaborateur {} retiré de l'organisation {}", keycloakUserId, organizationId);
        
        // Supprimer le compte Keycloak (optionnel, selon la politique de l'application)
        // Pour l'instant, on désactive plutôt que de supprimer pour garder l'historique
        try {
            keycloakAdminService.disableUser(keycloakUserId);
            log.info("Compte Keycloak {} désactivé après suppression de l'organisation", keycloakUserId);
        } catch (Exception e) {
            log.warn("Erreur lors de la désactivation du compte Keycloak {}: {}", keycloakUserId, e.getMessage());
            // Ne pas faire échouer la transaction si la désactivation Keycloak échoue
        }
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
     * Récupère l'ID de l'organisation d'un utilisateur.
     * EXIGE qu'un utilisateur soit associé à une organisation.
     * Un utilisateur DOIT toujours être associé à une organisation dans cette application.
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
                // S'assurer que le compte organisation est bien enregistré comme membre
                if (!organizationUserRepository.existsByOrganizationIdAndKeycloakUserId(organization.getId(), keycloakUserId)) {
                    OrganizationUser organizationUser = new OrganizationUser();
                    organizationUser.setOrganization(organization);
                    organizationUser.setKeycloakUserId(keycloakUserId);
                    organizationUserRepository.save(organizationUser);
                }
                return organization.getId();
            }
            throw new UserNotAssociatedException(
                    keycloakUserId,
                    "L'utilisateur doit être associé à une organisation. Aucune organisation trouvée."
            );
        }
        // Retourner la première organisation (on pourra améliorer cela plus tard)
        Organization organization = organizationUsers.get(0).getOrganization();
        if (organization == null) {
            throw new UserNotAssociatedException(
                keycloakUserId,
                "L'organisation associée à l'utilisateur est invalide."
            );
        }
        return organization.getId();
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
            throw new IllegalArgumentException(
                "Un utilisateur doit être associé à une organisation. organizationId ne peut pas être null."
            );
        }
        
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + organizationId));
        
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
     * Change le plan tarifaire d'une organisation.
     */
    @Transactional
    public OrganizationDto changePricingPlan(Long organizationId, Long pricingPlanId) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new IllegalArgumentException("Organisation non trouvée avec l'ID: " + organizationId));
        
        // Récupérer l'ancien plan pour la notification
        PricingPlanDto oldPlan = null;
        if (organization.getPricingPlanId() != null) {
            try {
                oldPlan = pricingPlanService.getPricingPlanById(organization.getPricingPlanId());
            } catch (Exception e) {
                log.warn("Impossible de récupérer l'ancien plan pour la notification: {}", e.getMessage());
            }
        }
        
        PricingPlanDto newPlan = null;
        String trialExpiresAtStr = null;
        
        // Valider le plan tarifaire
        if (pricingPlanId != null) {
            try {
                newPlan = pricingPlanService.getPricingPlanById(pricingPlanId);
                organization.setPricingPlanId(pricingPlanId);
                // Mettre à jour le quota selon le plan
                if (newPlan.getMonthlyQuota() != null) {
                    organization.setMonthlyQuota(newPlan.getMonthlyQuota());
                } else {
                    // Si le plan n'a pas de quota défini, garder le quota actuel ou le mettre à null
                    // (on peut décider de laisser le quota actuel)
                }
                // Si c'est un plan d'essai, définir la date d'expiration
                if (newPlan.getTrialPeriodDays() != null && newPlan.getTrialPeriodDays() > 0) {
                    organization.setTrialExpiresAt(LocalDateTime.now().plusDays(newPlan.getTrialPeriodDays()));
                    trialExpiresAtStr = organization.getTrialExpiresAt().toString();
                    log.info("Plan d'essai activé pour l'organisation {}: expiration dans {} jours", 
                        organization.getName(), newPlan.getTrialPeriodDays());
                } else {
                    // Si ce n'est pas un plan d'essai, réinitialiser la date d'expiration
                    organization.setTrialExpiresAt(null);
                }
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Plan tarifaire invalide: " + e.getMessage());
            }
        } else {
            // Permettre de retirer le plan tarifaire
            organization.setPricingPlanId(null);
            organization.setTrialExpiresAt(null);
        }
        
        organization = organizationRepository.save(organization);
        log.info("Plan tarifaire changé pour l'organisation {} (ID: {}): planId={}", 
            organization.getName(), organizationId, pricingPlanId);
        
        // Créer les factures pour le changement de plan
        LocalDate changeDate = LocalDate.now();
        try {
            // 1. Créer une facture de clôture pour l'ancien plan (si un ancien plan existait)
            if (oldPlan != null && oldPlan.getPricePerMonth() != null && oldPlan.getPricePerMonth().compareTo(java.math.BigDecimal.ZERO) > 0) {
                try {
                    invoiceService.generatePlanClosureInvoice(organizationId, oldPlan, changeDate);
                    log.info("Facture de clôture créée pour l'ancien plan {} de l'organisation {}", 
                        oldPlan.getName(), organization.getName());
                } catch (Exception e) {
                    log.error("Erreur lors de la création de la facture de clôture pour l'organisation {}: {}", 
                        organizationId, e.getMessage(), e);
                    // Ne pas faire échouer la transaction si la facture de clôture échoue
                }
            }
            
            // 2. Créer une facture de démarrage pour le nouveau plan (si un nouveau plan existe)
            if (newPlan != null && newPlan.getPricePerMonth() != null && newPlan.getPricePerMonth().compareTo(java.math.BigDecimal.ZERO) > 0) {
                try {
                    invoiceService.generatePlanStartInvoice(organizationId, newPlan, changeDate);
                    log.info("Facture de démarrage créée pour le nouveau plan {} de l'organisation {}", 
                        newPlan.getName(), organization.getName());
                } catch (Exception e) {
                    log.error("Erreur lors de la création de la facture de démarrage pour l'organisation {}: {}", 
                        organizationId, e.getMessage(), e);
                    // Ne pas faire échouer la transaction si la facture de démarrage échoue
                }
            }
        } catch (Exception e) {
            log.error("Erreur lors de la création des factures pour le changement de plan de l'organisation {}: {}", 
                organizationId, e.getMessage(), e);
            // Ne pas faire échouer la transaction si les factures échouent
        }
        
        // Envoyer l'email de notification
        try {
            sendPricingPlanChangeNotification(organization, oldPlan, newPlan, trialExpiresAtStr);
        } catch (Exception e) {
            log.error("Erreur lors de l'envoi de l'email de notification de changement de plan pour l'organisation {}: {}", 
                    organizationId, e.getMessage(), e);
            // Ne pas faire échouer la transaction si l'email échoue
        }
        
        return toDtoWithUserCount(organization);
    }
    
    /**
     * Envoie un email de notification de changement de plan tarifaire.
     */
    private void sendPricingPlanChangeNotification(Organization organization, PricingPlanDto oldPlan, 
                                                   PricingPlanDto newPlan, String trialExpiresAtStr) {
        // Liste des emails à notifier
        List<String> userEmails = new java.util.ArrayList<>();
        
        // Ajouter l'email de l'organisation
        if (organization.getEmail() != null && !organization.getEmail().trim().isEmpty()) {
            userEmails.add(organization.getEmail());
        }
        
        // Récupérer les emails des utilisateurs de l'organisation depuis Keycloak
        try {
            List<OrganizationUser> organizationUsers = organizationUserRepository.findByOrganizationId(organization.getId());
            List<String> keycloakUserIds = organizationUsers.stream()
                    .map(OrganizationUser::getKeycloakUserId)
                    .filter(id -> id != null && !id.trim().isEmpty())
                    .collect(Collectors.toList());
            
            if (!keycloakUserIds.isEmpty()) {
                List<String> userEmailsFromKeycloak = keycloakAdminService.getUserEmails(keycloakUserIds);
                // Ajouter les emails des utilisateurs (éviter les doublons)
                for (String email : userEmailsFromKeycloak) {
                    if (email != null && !email.trim().isEmpty() && !userEmails.contains(email)) {
                        userEmails.add(email);
                    }
                }
                log.debug("Récupéré {} email(s) d'utilisateurs depuis Keycloak pour l'organisation {}", 
                        userEmailsFromKeycloak.size(), organization.getId());
            }
        } catch (Exception e) {
            log.warn("Erreur lors de la récupération des emails des utilisateurs depuis Keycloak pour l'organisation {}: {}. " +
                    "L'email sera envoyé uniquement à l'adresse de l'organisation.", 
                    organization.getId(), e.getMessage());
            // Continuer avec l'email de l'organisation même si la récupération des emails utilisateurs échoue
        }
        
        // Préparer les données pour l'email
        String oldPlanName = oldPlan != null ? oldPlan.getName() : null;
        java.math.BigDecimal oldPlanPricePerMonth = oldPlan != null ? oldPlan.getPricePerMonth() : null;
        java.math.BigDecimal oldPlanPricePerRequest = oldPlan != null ? oldPlan.getPricePerRequest() : null;
        Integer oldPlanQuota = oldPlan != null ? oldPlan.getMonthlyQuota() : null;
        
        String newPlanName = newPlan != null ? newPlan.getName() : null;
        String newPlanDescription = newPlan != null ? newPlan.getDescription() : null;
        java.math.BigDecimal newPlanPricePerMonth = newPlan != null ? newPlan.getPricePerMonth() : null;
        java.math.BigDecimal newPlanPricePerRequest = newPlan != null ? newPlan.getPricePerRequest() : null;
        Integer newPlanQuota = newPlan != null ? newPlan.getMonthlyQuota() : null;
        Integer trialPeriodDays = newPlan != null ? newPlan.getTrialPeriodDays() : null;
        
        // Envoyer l'email à l'organisation
        if (!userEmails.isEmpty()) {
            emailService.sendPricingPlanChangedEmailToMultiple(
                    userEmails,
                    organization.getName(),
                    oldPlanName,
                    oldPlanPricePerMonth,
                    oldPlanPricePerRequest,
                    oldPlanQuota,
                    newPlanName,
                    newPlanDescription,
                    newPlanPricePerMonth,
                    newPlanPricePerRequest,
                    newPlanQuota,
                    trialPeriodDays,
                    trialExpiresAtStr
            );
        } else {
            log.warn("Aucun email trouvé pour envoyer la notification de changement de plan à l'organisation {}", 
                    organization.getId());
        }
    }
    
    /**
     * Convertit une Organisation en DTO.
     */
    private OrganizationDto toDto(Organization organization) {
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
        dto.setCreatedAt(organization.getCreatedAt());
        return dto;
    }
    
    /**
     * Récupère toutes les organisations avec un plan Pay-per-Request.
     * Un plan Pay-per-Request a pricePerRequest != null et monthlyQuota == null.
     */
    @Transactional(readOnly = true)
    public List<OrganizationDto> getOrganizationsWithPayPerRequestPlan() {
        List<Organization> organizations = organizationRepository.findAll();
        
        return organizations.stream()
                .filter(org -> org.getPricingPlanId() != null)
                .filter(org -> {
                    try {
                        PricingPlanDto plan = pricingPlanService.getPricingPlanById(org.getPricingPlanId());
                        return plan.getPricePerRequest() != null && plan.getMonthlyQuota() == null;
                    } catch (Exception e) {
                        log.warn("Impossible de récupérer le plan pour l'organisation {}: {}", 
                                org.getId(), e.getMessage());
                        return false;
                    }
                })
                .map(this::toDto)
                .collect(Collectors.toList());
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
}

