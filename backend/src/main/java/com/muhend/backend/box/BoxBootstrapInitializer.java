package com.muhend.backend.box;

import com.muhend.backend.auth.service.KeycloakAdminService;
import com.muhend.backend.organization.dto.CreateOrganizationRequest;
import com.muhend.backend.organization.dto.OrganizationDto;
import com.muhend.backend.organization.repository.OrganizationRepository;
import com.muhend.backend.organization.service.CollaboratorService;
import com.muhend.backend.organization.service.OrganizationService;
import jakarta.ws.rs.core.Response;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Initialise automatiquement l'organisation cliente unique et son compte administrateur Keycloak
 * au premier démarrage de la Box Locale Algérie.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class BoxBootstrapInitializer implements ApplicationRunner {

    private final OrganizationRepository organizationRepository;
    private final OrganizationService organizationService;
    private final CollaboratorService collaboratorService;
    private final KeycloakAdminService keycloakAdminService;

    @Value("${box.bootstrap.enabled:true}")
    private boolean bootstrapEnabled;

    @Value("${box.bootstrap.org-name:}")
    private String orgName;

    @Value("${box.bootstrap.org-email:}")
    private String orgEmail;

    @Value("${box.bootstrap.org-password:}")
    private String orgPassword;

    @Value("${box.bootstrap.org-address:Algérie}")
    private String orgAddress;

    @Value("${box.bootstrap.org-phone:+213000000000}")
    private String orgPhone;

    @Value("${box.bootstrap.org-activity-domain:Commerce International}")
    private String orgActivityDomain;

    @Override
    public void run(ApplicationArguments args) {
        if (!bootstrapEnabled) {
            return;
        }
        if (organizationRepository.count() > 0) {
            log.info("[BOX] Organisation déjà initialisée, bootstrap ignoré.");
            return;
        }
        if (isBlank(orgName) || isBlank(orgEmail) || isBlank(orgPassword)) {
            log.warn("[BOX] Bootstrap ignoré : ORG_NAME, ORG_EMAIL ou ORG_PASSWORD non renseigné.");
            return;
        }

        String trimmedEmail = orgEmail.trim();
        String trimmedName = orgName.trim();
        int maxAttempts = 6;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                if (organizationRepository.count() > 0) {
                    return;
                }
                String keycloakUserId = keycloakAdminService.getUserIdByUsername(trimmedEmail);

                if (keycloakUserId == null) {
                    Response response = keycloakAdminService.createUser(
                            trimmedEmail,
                            trimmedEmail,
                            orgPassword,
                            trimmedName,
                            null,
                            true,
                            true,
                            null,
                            Map.of("account_type", List.of("ORGANIZATION")),
                            false
                    );
                    int status = response.getStatus();
                    if (status >= 200 && status < 300) {
                        keycloakUserId = keycloakAdminService.getUserIdFromResponse(response);
                        response.close();
                    } else if (status == Response.Status.CONFLICT.getStatusCode()) {
                        response.close();
                        keycloakUserId = keycloakAdminService.getUserIdByUsername(trimmedEmail);
                    } else {
                        String err = response.hasEntity() ? response.readEntity(String.class) : "N/A";
                        response.close();
                        throw new IllegalStateException("Keycloak status=" + status + ", body=" + err);
                    }
                }

                if (keycloakUserId == null) {
                    keycloakUserId = keycloakAdminService.getUserIdByUsername(trimmedEmail);
                }
                if (keycloakUserId == null) {
                    throw new IllegalStateException("Impossible de résoudre l'ID Keycloak pour " + trimmedEmail);
                }

                keycloakAdminService.assignRealmRoles(keycloakUserId, List.of("ORGANIZATION", "USER", "COLLABORATOR"));

                String safeAddress = (!isBlank(orgAddress) && orgAddress.trim().length() >= 5)
                        ? orgAddress.trim()
                        : "Algérie";
                String safePhone = (!isBlank(orgPhone) && orgPhone.trim().length() >= 5)
                        ? orgPhone.trim()
                        : "+213000000000";

                CreateOrganizationRequest req = new CreateOrganizationRequest();
                req.setName(trimmedName);
                req.setEmail(trimmedEmail);
                req.setAddress(safeAddress);
                req.setPhone(safePhone);
                req.setCountry("DZ");
                req.setMarketVersion("DZ");
                req.setActivityDomain(isBlank(orgActivityDomain) ? "Commerce International" : orgActivityDomain.trim());
                req.setOrganizationPassword(orgPassword);
                req.setKeycloakUserId(keycloakUserId);

                OrganizationDto created = organizationService.createOrganization(req);
                collaboratorService.addUserToOrganization(created.getId(), keycloakUserId);

                log.info("[BOX] Organisation initiale '{}' ({}) prête (id={}).",
                        created.getName(), created.getEmail(), created.getId());
                return;
            } catch (Exception e) {
                if (attempt < maxAttempts) {
                    log.warn("[BOX] Attente disponibilité Keycloak pour le bootstrap ({}/{}): {}",
                            attempt, maxAttempts, e.getMessage());
                    try {
                        Thread.sleep(3000L);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        return;
                    }
                } else {
                    log.error("[BOX] Erreur lors du bootstrap de l'organisation initiale (non bloquant): {}",
                            e.getMessage(), e);
                }
            }
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
