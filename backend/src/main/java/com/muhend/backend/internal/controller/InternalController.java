package com.muhend.backend.internal.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.muhend.backend.internal.dto.QuotaCheckResponse;
import com.muhend.backend.organization.dto.QuotaCheckResult;
import com.muhend.backend.organization.exception.UserNotAssociatedException;
import com.muhend.backend.organization.service.OrganizationService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Contrôleur pour les endpoints internes utilisés par les micro-services.
 * Ces endpoints ne sont pas exposés aux clients externes.
 */
@RestController
@RequestMapping("/internal")
@RequiredArgsConstructor
@Slf4j
public class InternalController {

    private final OrganizationService organizationService;

    /**
     * Vérifie le quota de l'utilisateur courant.
     * Utilisé par le search-service avant chaque recherche.
     */
    @GetMapping("/quota-check")
    public ResponseEntity<QuotaCheckResponse> checkQuota() {
        try {
            String userId = getCurrentUserId();
            if (userId == null) {
                return ResponseEntity.ok(QuotaCheckResponse.builder()
                        .canSearch(false)
                        .message("Utilisateur non authentifié")
                        .build());
            }

            // Récupérer l'organisation
            Long organizationId;
            try {
                organizationId = organizationService.getOrganizationIdByUserId(userId);
            } catch (UserNotAssociatedException e) {
                return ResponseEntity.ok(QuotaCheckResponse.builder()
                        .canSearch(false)
                        .message("Utilisateur non associé à une organisation")
                        .build());
            }

            // Vérifier si l'organisation peut faire des requêtes
            if (!organizationService.canOrganizationMakeRequests(organizationId)) {
                return ResponseEntity.ok(QuotaCheckResponse.builder()
                        .canSearch(false)
                        .organizationId(organizationId)
                        .message("Organisation désactivée ou essai expiré")
                        .build());
            }

            // Vérifier le quota avec détails
            QuotaCheckResult quotaResult = organizationService.checkQuotaWithResult(organizationId);

            QuotaCheckResponse response = QuotaCheckResponse.builder()
                    .canSearch(true)
                    .quotaOk(quotaResult.isQuotaOk())
                    .canUsePayPerRequest(quotaResult.isCanUsePayPerRequest())
                    .organizationId(organizationId)
                    .currentUsage(Math.toIntExact(quotaResult.getCurrentUsage()))
                    .monthlyQuota(quotaResult.getMonthlyQuota())
                    .payPerRequestPrice(quotaResult.getPayPerRequestPrice())
                    .build();

            // Si quota dépassé et pas de pay-per-request, bloquer
            if (!quotaResult.isQuotaOk() && !quotaResult.isCanUsePayPerRequest()) {
                response.setCanSearch(false);
                response.setMessage("Quota mensuel dépassé. Aucun plan pay-per-request disponible.");
            }

            log.debug("Quota check pour org {}: canSearch={}, quotaOk={}",
                    organizationId, response.isCanSearch(), response.isQuotaOk());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Erreur lors de la vérification du quota: {}", e.getMessage());
            return ResponseEntity.ok(QuotaCheckResponse.builder()
                    .canSearch(false)
                    .message("Erreur lors de la vérification du quota: " + e.getMessage())
                    .build());
        }
    }

    private String getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
            return jwt.getClaimAsString("sub");
        }
        return null;
    }
}
