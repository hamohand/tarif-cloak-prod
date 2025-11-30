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

import java.math.BigDecimal;
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
        
        // Envoyer une notification à l'administrateur
        try {
            String adminEmail = System.getenv("EMAIL_ADMIN_HSCODE");
            if (adminEmail != null && !adminEmail.trim().isEmpty()) {
                emailService.sendNewOrganizationNotificationEmail(
                    adminEmail.trim(),
                    organization.getName(),
                    organization.getAddress()
                );
            } else {
                log.debug("EMAIL_ADMIN_HSCODE non configuré, notification admin non envoyée");
            }
        } catch (Exception e) {
            log.warn("Erreur lors de l'envoi de la notification admin pour la nouvelle organisation {}: {}", 
                organization.getName(), e.getMessage());
            // Ne pas faire échouer la création d'organisation si l'email admin échoue
        }
        
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
     * IMPORTANT : La consommation en requêtes est comptée au niveau de l'organisation.
     * Elle est égale à la somme des consommations de tous les collaborateurs de l'organisation.
     * Le quota est partagé entre tous les utilisateurs de l'organisation.
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
        Long pricingPlanId = organization.getPricingPlanId();
        
        log.debug("Vérification du quota pour l'organisation {} (ID: {}): quota={}, planId={}", 
            organization.getName(), organizationId, monthlyQuota, pricingPlanId);
        
        // Si le quota est null, il est illimité (plan pay-per-request ou illimité)
        if (monthlyQuota == null) {
            log.debug("Quota illimité pour l'organisation {} (plan pay-per-request ou illimité)", organization.getName());
            return true;
        }
        
        // Calculer le début et la fin du mois en cours
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startOfMonth = now.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime endOfMonth = now.withDayOfMonth(now.toLocalDate().lengthOfMonth())
                .withHour(23).withMinute(59).withSecond(59).withNano(999999999);
        
        // Compter les requêtes du mois en cours pour TOUTE l'organisation
        // (somme de toutes les requêtes de tous les collaborateurs)
        long currentUsage = usageLogRepository.countByOrganizationIdAndTimestampBetween(
                organizationId, startOfMonth, endOfMonth);
        
        log.info("🔍 Vérification du quota pour l'organisation {} (ID: {}): utilisation actuelle={}, quota={}, planId={}, période: {} à {}", 
            organization.getName(), organizationId, currentUsage, monthlyQuota, pricingPlanId, startOfMonth, endOfMonth);
        
        // Vérifier si le quota est dépassé
        if (currentUsage >= monthlyQuota) {
            String message = String.format(
                    "Quota mensuel dépassé pour l'organisation '%s' (ID: %d). Utilisation: %d/%d requêtes (planId: %s)",
                    organization.getName(), organizationId, currentUsage, monthlyQuota, pricingPlanId);
            log.warn("❌ {} - Vérifiez que le quota du plan {} correspond bien au quota de l'organisation. " +
                    "Si le plan vient d'être changé, le quota devrait être mis à jour.", message, pricingPlanId);
            throw new QuotaExceededException(message);
        }
        
        log.info("✅ Quota OK pour l'organisation {} (ID: {}): {}/{} requêtes utilisées ce mois (planId: {})", 
                 organization.getName(), organizationId, currentUsage, monthlyQuota, pricingPlanId);
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
                
                // Vérifier si l'organisation essaie de revenir à un plan d'essai alors que l'essai est définitivement terminé
                if (Boolean.TRUE.equals(organization.getTrialPermanentlyExpired()) 
                        && newPlan.getTrialPeriodDays() != null && newPlan.getTrialPeriodDays() > 0) {
                    throw new IllegalArgumentException(
                        "Impossible de revenir au plan d'essai. Votre essai gratuit est définitivement terminé. " +
                        "Veuillez choisir un plan payant ou faire une demande de devis."
                    );
                }
                
                organization.setPricingPlanId(pricingPlanId);
                // Mettre à jour le quota selon le plan
                Integer oldQuota = organization.getMonthlyQuota();
                log.info("🔄 Changement de plan pour l'organisation {} (ID: {}): ancien quota={}, nouveau plan={} (ID: {}), monthlyQuota du plan={}, pricePerRequest={}", 
                    organization.getName(), organizationId, oldQuota, newPlan.getName(), pricingPlanId, newPlan.getMonthlyQuota(), newPlan.getPricePerRequest());
                
                // Pour les plans pay-per-request (pricePerRequest != null), le quota doit être null (illimité)
                // Pour les plans mensuels avec quota défini, utiliser le quota du plan
                // Pour les plans mensuels sans quota défini, mettre à null (illimité)
                boolean hasPricePerRequest = newPlan.getPricePerRequest() != null && newPlan.getPricePerRequest().compareTo(BigDecimal.ZERO) > 0;
                boolean hasPricePerMonth = newPlan.getPricePerMonth() != null && newPlan.getPricePerMonth().compareTo(BigDecimal.ZERO) > 0;
                boolean isPayPerRequest = hasPricePerRequest && !hasPricePerMonth; // Plan pay-per-request si pricePerRequest > 0 ET pricePerMonth est null ou 0
                
                log.info("🔍 Analyse du plan {} (ID: {}): pricePerRequest={}, pricePerMonth={}, monthlyQuota={}, isPayPerRequest={}", 
                    newPlan.getName(), pricingPlanId, newPlan.getPricePerRequest(), newPlan.getPricePerMonth(), newPlan.getMonthlyQuota(), isPayPerRequest);
                
                if (isPayPerRequest) {
                    // Plan pay-per-request : quota illimité (ignorer le monthlyQuota du plan s'il existe)
                    organization.setMonthlyQuota(null);
                    log.info("✅ Quota mensuel mis à null (illimité - plan pay-per-request) pour l'organisation {} (ID: {}): {} -> null (plan: {} - ID: {})", 
                        organization.getName(), organizationId, oldQuota, newPlan.getName(), pricingPlanId);
                } else if (newPlan.getMonthlyQuota() != null && newPlan.getMonthlyQuota() > 0) {
                    // Plan mensuel avec quota défini
                    organization.setMonthlyQuota(newPlan.getMonthlyQuota());
                    log.info("✅ Quota mensuel mis à jour pour l'organisation {} (ID: {}): {} -> {} requêtes/mois (plan: {} - ID: {})", 
                        organization.getName(), organizationId, oldQuota, newPlan.getMonthlyQuota(), newPlan.getName(), pricingPlanId);
                } else {
                    // Plan mensuel sans quota défini : quota illimité
                    organization.setMonthlyQuota(null);
                    log.info("✅ Quota mensuel mis à null (illimité - plan sans quota) pour l'organisation {} (ID: {}): {} -> null (plan: {} - ID: {})", 
                        organization.getName(), organizationId, oldQuota, newPlan.getName(), pricingPlanId);
                }
                // Si c'est un plan d'essai, définir la date d'expiration
                if (newPlan.getTrialPeriodDays() != null && newPlan.getTrialPeriodDays() > 0) {
                    organization.setTrialExpiresAt(LocalDateTime.now().plusDays(newPlan.getTrialPeriodDays()));
                    trialExpiresAtStr = organization.getTrialExpiresAt().toString();
                    log.info("Plan d'essai activé pour l'organisation {}: expiration dans {} jours", 
                        organization.getName(), newPlan.getTrialPeriodDays());
                } else {
                    // Si c'est un plan payant, réinitialiser la date d'expiration et le flag trialPermanentlyExpired
                    organization.setTrialExpiresAt(null);
                    // Si l'organisation passe à un plan payant, réinitialiser le flag trialPermanentlyExpired
                    boolean isPaidPlan = (newPlan.getPricePerMonth() != null && newPlan.getPricePerMonth().compareTo(BigDecimal.ZERO) > 0)
                            || (newPlan.getPricePerRequest() != null && newPlan.getPricePerRequest().compareTo(BigDecimal.ZERO) > 0);
                    if (isPaidPlan && Boolean.TRUE.equals(organization.getTrialPermanentlyExpired())) {
                        organization.setTrialPermanentlyExpired(false);
                        log.info("Flag trialPermanentlyExpired réinitialisé pour l'organisation {} (plan payant sélectionné)", 
                                organization.getName());
                    }
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
        log.info("💾 Plan tarifaire changé pour l'organisation {} (ID: {}): planId={}, nouveau quota={}", 
            organization.getName(), organizationId, pricingPlanId, organization.getMonthlyQuota());
        
        // Forcer le flush pour s'assurer que les changements sont persistés
        organizationRepository.flush();
        
        // Vérifier que le quota a bien été mis à jour en récupérant l'organisation depuis la base de données
        Organization savedOrg = organizationRepository.findById(organizationId).orElse(null);
        if (savedOrg != null) {
            log.info("🔍 Vérification après sauvegarde - Organisation {} (ID: {}): quota={}, planId={}", 
                savedOrg.getName(), organizationId, savedOrg.getMonthlyQuota(), savedOrg.getPricingPlanId());
            if (!java.util.Objects.equals(savedOrg.getMonthlyQuota(), organization.getMonthlyQuota())) {
                log.error("❌ ERREUR: Le quota sauvegardé ({}) ne correspond pas au quota attendu ({})", 
                    savedOrg.getMonthlyQuota(), organization.getMonthlyQuota());
            }
        } else {
            log.error("❌ ERREUR: Impossible de récupérer l'organisation {} après la sauvegarde", organizationId);
        }
        
        // Si l'essai était expiré et qu'un plan payant est maintenant sélectionné, réactiver les collaborateurs
        boolean wasTrialExpired = isTrialExpired(organization);
        if (wasTrialExpired && newPlan != null) {
            // Vérifier si c'est un plan payant
            boolean isPaidPlan = (newPlan.getPricePerMonth() != null && newPlan.getPricePerMonth().compareTo(BigDecimal.ZERO) > 0)
                    || (newPlan.getPricePerRequest() != null && newPlan.getPricePerRequest().compareTo(BigDecimal.ZERO) > 0);
            if (isPaidPlan && canOrganizationMakeRequests(organization)) {
                log.info("Réactivation automatique des collaborateurs pour l'organisation {} (plan payant sélectionné)", 
                        organization.getName());
                reactivateAllCollaborators(organization);
            }
        }
        
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
        dto.setTrialPermanentlyExpired(organization.getTrialPermanentlyExpired());
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
    
    /**
     * Vérifie si l'essai gratuit d'une organisation est expiré.
     * Pour un plan d'essai avec quota, l'essai est expiré seulement si le quota est atteint.
     * La date d'expiration est une limite secondaire : si le quota n'est pas atteint,
     * l'organisation peut continuer même si la date est passée.
     * 
     * Un essai est considéré comme expiré si :
     * - Pour un plan avec quota : le quota est atteint ET l'organisation n'a pas de plan payant
     * - Pour un plan sans quota : trialExpiresAt n'est pas null ET est dans le passé ET l'organisation n'a pas de plan payant
     *
     * @param organization L'organisation à vérifier
     * @return true si l'essai est expiré, false sinon
     */
    @Transactional(readOnly = true)
    public boolean isTrialExpired(Organization organization) {
        if (organization.getTrialExpiresAt() == null) {
            // Pas d'essai, donc pas expiré
            return false;
        }
        
        // Vérifier d'abord le quota si l'organisation en a un
        // Pour un plan d'essai avec quota, l'essai expire seulement quand le quota est atteint
        Integer monthlyQuota = organization.getMonthlyQuota();
        if (monthlyQuota != null) {
            // Calculer l'utilisation actuelle
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime startOfMonth = now.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
            LocalDateTime endOfMonth = now.withDayOfMonth(now.toLocalDate().lengthOfMonth())
                    .withHour(23).withMinute(59).withSecond(59).withNano(999999999);
            
            long currentUsage = usageLogRepository.countByOrganizationIdAndTimestampBetween(
                    organization.getId(), startOfMonth, endOfMonth);
            
            // Si le quota n'est pas atteint, l'essai n'est pas expiré (même si la date est passée)
            if (currentUsage < monthlyQuota) {
                log.debug("Essai non expiré pour l'organisation {}: quota non atteint ({}/{})", 
                        organization.getId(), currentUsage, monthlyQuota);
                return false;
            }
            
            // Si le quota est atteint, vérifier si l'organisation a un plan payant
            if (organization.getPricingPlanId() != null) {
                try {
                    PricingPlanDto plan = pricingPlanService.getPricingPlanById(organization.getPricingPlanId());
                    boolean isPaidPlan = (plan.getPricePerMonth() != null && plan.getPricePerMonth().compareTo(BigDecimal.ZERO) > 0)
                            || (plan.getPricePerRequest() != null && plan.getPricePerRequest().compareTo(BigDecimal.ZERO) > 0);
                    // Si c'est un plan payant, l'essai n'est pas expiré (l'organisation peut continuer)
                    if (isPaidPlan) {
                        return false;
                    }
                } catch (Exception e) {
                    log.warn("Impossible de récupérer le plan pour vérifier l'expiration de l'essai: {}", e.getMessage());
                }
            }
            
            // Quota atteint et pas de plan payant = essai expiré
            // Marquer l'essai comme définitivement terminé (ne peut plus être réactivé)
            if (!Boolean.TRUE.equals(organization.getTrialPermanentlyExpired())) {
                organization.setTrialPermanentlyExpired(true);
                organizationRepository.save(organization);
                log.info("Essai définitivement terminé pour l'organisation {}: quota atteint ({}/{})", 
                        organization.getId(), currentUsage, monthlyQuota);
            }
            return true;
        }
        
        // Si pas de quota défini, utiliser la date d'expiration comme seule limite
        LocalDateTime now = LocalDateTime.now();
        if (organization.getTrialExpiresAt().isBefore(now)) {
            // L'essai est expiré, vérifier si l'organisation a un plan payant
            if (organization.getPricingPlanId() != null) {
                try {
                    PricingPlanDto plan = pricingPlanService.getPricingPlanById(organization.getPricingPlanId());
                    // Si le plan a un prix > 0, c'est un plan payant
                    boolean isPaidPlan = (plan.getPricePerMonth() != null && plan.getPricePerMonth().compareTo(BigDecimal.ZERO) > 0)
                            || (plan.getPricePerRequest() != null && plan.getPricePerRequest().compareTo(BigDecimal.ZERO) > 0);
                    // L'essai est expiré ET l'organisation n'a pas de plan payant
                    return !isPaidPlan;
                } catch (Exception e) {
                    log.warn("Impossible de récupérer le plan pour vérifier l'expiration de l'essai: {}", e.getMessage());
                    // En cas d'erreur, considérer que l'essai est expiré pour sécurité
                    return true;
                }
            }
            // Essai expiré et pas de plan = essai expiré
            return true;
        }
        
        // L'essai n'est pas encore expiré
        return false;
    }
    
    /**
     * Vérifie si une organisation peut effectuer des requêtes.
     * Une organisation ne peut pas faire de requêtes si :
     * - Son essai gratuit est expiré et elle n'a pas de plan payant
     *
     * @param organization L'organisation à vérifier
     * @return true si l'organisation peut faire des requêtes, false sinon
     */
    @Transactional(readOnly = true)
    public boolean canOrganizationMakeRequests(Organization organization) {
        return !isTrialExpired(organization);
    }
    
    /**
     * Vérifie si une organisation peut effectuer des requêtes à partir de son ID.
     * Cette méthode peut modifier l'organisation (mettre à jour trialPermanentlyExpired) si nécessaire.
     *
     * @param organizationId L'ID de l'organisation à vérifier
     * @return true si l'organisation peut faire des requêtes, false sinon
     */
    @Transactional
    public boolean canOrganizationMakeRequests(Long organizationId) {
        Optional<Organization> organizationOpt = organizationRepository.findById(organizationId);
        if (organizationOpt.isEmpty()) {
            log.warn("Organisation {} introuvable lors de la vérification de l'essai", organizationId);
            return false;
        }
        return canOrganizationMakeRequests(organizationOpt.get());
    }
    
    /**
     * Suspend tous les collaborateurs d'une organisation en les désactivant dans Keycloak.
     * Cette méthode est appelée quand l'essai gratuit est expiré.
     *
     * @param organization L'organisation dont les collaborateurs doivent être suspendus
     */
    @Transactional
    public void suspendAllCollaborators(Organization organization) {
        List<OrganizationUser> collaborators = organizationUserRepository.findByOrganizationId(organization.getId());
        log.info("Suspension de {} collaborateurs pour l'organisation {}", collaborators.size(), organization.getId());
        
        for (OrganizationUser collaborator : collaborators) {
            try {
                // Vérifier si le collaborateur est différent du propriétaire de l'organisation
                // (le propriétaire est celui qui a créé l'organisation)
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
                // Continuer avec les autres collaborateurs même en cas d'erreur
            }
        }
    }
    
    /**
     * Réactive tous les collaborateurs d'une organisation en les activant dans Keycloak.
     * Cette méthode est appelée quand l'organisation souscrit à un plan payant après l'expiration de l'essai.
     *
     * @param organization L'organisation dont les collaborateurs doivent être réactivés
     */
    @Transactional
    public void reactivateAllCollaborators(Organization organization) {
        List<OrganizationUser> collaborators = organizationUserRepository.findByOrganizationId(organization.getId());
        log.info("Réactivation de {} collaborateurs pour l'organisation {}", collaborators.size(), organization.getId());
        
        for (OrganizationUser collaborator : collaborators) {
            try {
                keycloakAdminService.enableUser(collaborator.getKeycloakUserId());
                log.info("Collaborateur {} réactivé pour l'organisation {}", 
                        collaborator.getKeycloakUserId(), organization.getId());
            } catch (Exception e) {
                log.error("Erreur lors de la réactivation du collaborateur {}: {}", 
                        collaborator.getKeycloakUserId(), e.getMessage(), e);
                // Continuer avec les autres collaborateurs même en cas d'erreur
            }
        }
    }
    
    /**
     * Vérifie et suspend automatiquement les collaborateurs si l'essai est expiré.
     * Cette méthode doit être appelée régulièrement (par exemple via un scheduler).
     *
     * @param organization L'organisation à vérifier
     */
    @Transactional
    public void checkAndSuspendIfTrialExpired(Organization organization) {
        if (isTrialExpired(organization)) {
            log.info("L'essai de l'organisation {} est expiré. Suspension des collaborateurs.", organization.getId());
            suspendAllCollaborators(organization);
        }
    }
}

